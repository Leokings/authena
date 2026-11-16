#!/usr/bin/env tsx
/**
 * Judgment tests: is the judge fair both ways? Lists each skill in fixtures/cases.json, challenges
 * it with the quoted passage, relays the dispute, and compares the verdict with what a careful
 * reader would expect. Also runs the two removal paths (a listed skill caught later, and a false
 * removal request). Resumable.
 *
 *   npx tsx --env-file=../agentscore/.env scripts/judge-cases.ts <fixtures-commit>
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { Hex } from "viem";
import { deployment, explorerTx, pub, roleWallet } from "./lib";
import { challenge, execute, list, listingOf, relay, requestRemoval, status, store } from "./curate-lib";

const FIX = process.argv[2];
if (!/^[0-9a-f]{40}$/.test(FIX ?? "")) {
  console.error("usage: judge-cases.ts <40-character commit of this repo that holds the fixtures>");
  process.exit(1);
}
const ME = "Leokings/authena";
const cases: Array<{ id: string; why: string; quote: string; expect: string }> = JSON.parse(readFileSync("fixtures/cases.json", "utf8"));
for (const c of cases) {
  if (!readFileSync(`fixtures/skills/${c.id}/SKILL.md`, "utf8").includes(c.quote)) throw new Error(`${c.id}: the quote is not in the file`);
}
const accuse = (quote: string) => JSON.stringify({ file: "SKILL.md", quote });
const state = store<Record<string, any>>("deployments/judgment-tests-state.json", {});
async function step<T>(key: string, run: () => Promise<T>): Promise<T> {
  if (state.data[key] === undefined) {
    state.data[key] = await run();
    state.save();
    console.log(`✓ ${key}`, JSON.stringify(state.data[key]).slice(0, 200));
  }
  return state.data[key];
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const publisher = roleWallet("publisher") as any;
const hunter = roleWallet("hunter") as any;
const dep = deployment();

// The skill that will be caught after it is listed goes first, so its window runs meanwhile.
const LATER = cases.find((c) => c.id === "sneaky-transcript-leak")!;
const laterListing = listingOf(ME, FIX, `fixtures/skills/${LATER.id}/`); // trailing slash: a separate item
const later = await step("removal-caught-later/list", () => list(publisher, laterListing));

// 1. Registration challenges: one per case.
for (const c of cases) await step(`${c.id}/list`, () => list(publisher, listingOf(ME, FIX, `fixtures/skills/${c.id}`)));
for (const c of cases) await step(`${c.id}/challenge`, () => challenge(hunter, state.data[`${c.id}/list`].itemId, accuse(c.quote)));
for (const c of cases) await step(`${c.id}/relay`, () => relay(state.data[`${c.id}/challenge`].tx as Hex, `test-${c.id}`));

// 2. A listed skill is caught later: nobody challenged it, it was registered, then a hunter asks
//    for its removal with the quote and the publisher's side disputes that.
await step("removal-caught-later/execute", async () => {
  const listed = await pub.getTransactionReceipt({ hash: later.tx });
  const openedAt = Number((await pub.getBlock({ blockNumber: listed.blockNumber })).timestamp);
  const wait = openedAt + Number(dep.challengePeriodSeconds) + 15 - Math.floor(Date.now() / 1000);
  if (wait > 0) await sleep(wait * 1000);
  return execute(publisher, later.itemId);
});
await step("removal-caught-later/request", () => requestRemoval(hunter, later.itemId, accuse(LATER.quote)));
await step("removal-caught-later/challenge", () => challenge(publisher, later.itemId, ""));
await step("removal-caught-later/relay", () => relay(state.data["removal-caught-later/challenge"].tx as Hex, "test-removal-caught-later"));

// 3. A false removal request against a clean, registered skill.
const honest = state.data["honest-payments/list"];
if ((await status(honest.itemId)) === "registered" || state.data["removal-false/request"]) {
  const quote = cases.find((c) => c.id === "honest-payments")!.quote;
  await step("removal-false/request", () => requestRemoval(hunter, honest.itemId, accuse(quote)));
  await step("removal-false/challenge", () => challenge(publisher, honest.itemId, ""));
  await step("removal-false/relay", () => relay(state.data["removal-false/challenge"].tx as Hex, "test-removal-false"));
}

// 4. Results.
const row = (id: string, why: string, expect: string, expectStatus: string, itemId: Hex, r: any) => ({
  id,
  why,
  expected: expect,
  got: r?.verdict?.finding ?? null,
  judged_by: r?.verdict?.judged_by ?? null,
  request_type: r?.verdict?.request_type ?? null,
  ruling: r?.verdict?.ruling ?? null,
  genlayer_tx: r?.judge?.tx ? `https://explorer-studio.genlayer.com/tx/${r.judge.tx}` : null,
  votes: r?.judge ? { agree: r.judge.agree, disagree: r.judge.disagree } : null,
  ruling_tx: r?.rulingTx ? explorerTx(r.rulingTx) : null,
  expected_status: expectStatus,
  item_id: itemId,
});
const results: any[] = [];
for (const c of cases) results.push(row(c.id, c.why, c.expect, c.expect === "MALICIOUS" ? "absent" : "registered", state.data[`${c.id}/list`].itemId, state.data[`${c.id}/relay`]));
results.push(row("removal-caught-later", "A listed skill is caught afterwards through a removal request.", "MALICIOUS", "absent", later.itemId, state.data["removal-caught-later/relay"]));
if (state.data["removal-false/relay"]) results.push(row("removal-false", "A removal request against a clean skill fails and the skill stays listed.", "BENIGN", "registered", honest.itemId, state.data["removal-false/relay"]));
for (const r of results) {
  r.final_status = await status(r.item_id);
  r.pass = r.got === r.expected && r.final_status === r.expected_status;
}
writeFileSync("deployments/judgment-tests.json", JSON.stringify({ fixtures_commit: FIX, registry: dep.registry, results }, null, 2) + "\n");
console.table(results.map((r) => ({ id: r.id, expected: r.expected, got: r.got, status: r.final_status, pass: r.pass })));
console.log(`${results.filter((r) => r.pass).length} of ${results.length} as expected`);
