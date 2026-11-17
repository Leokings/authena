#!/usr/bin/env tsx
/**
 * The live demo: thirteen skill versions (fixtures/demo.json) go through the Authena Curate list
 * on Sepolia. Each listing and each accusation is a file on IPFS in Curate's own format, so the
 * list also shows on Kleros's website. Disputes are relayed to the judge on GenLayer and the
 * rulings back. Resumable: finished steps are kept in deployments/demo-state.json.
 *
 *   npx tsx --env-file=../agentscore/.env scripts/live-demo.ts
 *
 * Needs deployments/ipfs.json (scripts/kleros-upload.ts). Only this repository's own fixture
 * skills are ever accused.
 */
import { readFileSync } from "node:fs";
import type { Hex } from "viem";
import { artifact, deployment, pub, roleWallet } from "./lib";
import { challenge, execute, genlayerWrite, list, relay, requestRemoval, status, store } from "./curate-lib";
import { cases, type Case } from "./kleros-lib";

const plan = JSON.parse(readFileSync("kleros/build/files.json", "utf8"));
const ipfs = JSON.parse(readFileSync("deployments/ipfs.json", "utf8"));
if (ipfs.fixturesCommit !== plan.fixturesCommit) throw new Error("deployments/ipfs.json was made for another fixtures commit; rerun kleros-files.ts and kleros-upload.ts");
const cidOf = (name: string): string => {
  const sha = plan.files.find((f: any) => f.name === name)?.sha256;
  const cid = ipfs.bySha[sha]?.cid;
  if (!cid) throw new Error(`${name} has not been uploaded yet (scripts/kleros-upload.ts)`);
  return cid;
};
const itemUri = (c: Case) => cidOf(plan.items[c.id]);
const evidenceUri = (c: Case) => cidOf(plan.evidence[c.id]);

const all = cases();
const of = (flow: Case["flow"]) => all.filter((c) => c.flow === flow);
const state = store<Record<string, any>>("deployments/demo-state.json", {});
async function step<T>(key: string, run: () => Promise<T>): Promise<T> {
  if (state.data[key] === undefined) {
    state.data[key] = await run();
    state.save();
    console.log(`✓ ${key}`, JSON.stringify(state.data[key]).slice(0, 200));
  }
  return state.data[key];
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitUntil(tx: Hex, seconds: number, what: string) {
  const mined = await pub.getTransactionReceipt({ hash: tx });
  const at = Number((await pub.getBlock({ blockNumber: mined.blockNumber })).timestamp);
  const wait = at + seconds + 20 - Math.floor(Date.now() / 1000);
  if (wait > 0) {
    console.log(`waiting ${Math.ceil(wait / 60)} min for ${what}…`);
    await sleep(wait * 1000);
  }
}

const publisher = roleWallet("publisher") as any;
const hunter = roleWallet("hunter") as any;
const dep = deployment();
const S = state.data;

// 1. List everything. The two that nobody challenges go first, so their windows run meanwhile.
for (const c of [...of("unchallenged"), ...of("caught-later"), ...of("challenge"), ...of("timeout")]) await step(`${c.id}/list`, () => list(publisher, itemUri(c)));

// 2. Challenge, each with its accusation file.
for (const c of [...of("challenge"), ...of("timeout")]) await step(`${c.id}/challenge`, () => challenge(hunter, S[`${c.id}/list`].itemId, evidenceUri(c)));

// 3. Guards on GenLayer that need a dispute nobody has judged.
const idle = of("timeout")[0];
const idleDispute = S[`${idle.id}/challenge`];
await step("guard/quote-tx-mismatch", async () => genlayerWrite("EXPECTED-quote-tx-mismatch", "judge", [idleDispute.disputeId, S[`${idle.id}/list`].tx, idleDispute.tx, S[`${idle.id}/list`].tx]));
await step("guard/dispute-not-found", async () => genlayerWrite("EXPECTED-dispute-not-found", "judge", [999999, S[`${idle.id}/list`].tx, idleDispute.tx, idleDispute.tx]));

// 4. Relay every challenged listing: GenLayer judges, the adapter passes the ruling to Curate.
for (const c of of("challenge")) await step(`${c.id}/relay`, () => relay(S[`${c.id}/challenge`].tx as Hex, c.id, S[`${c.id}/relay-attempt`]?.judge));

// 5. A dispute cannot be judged twice.
const first = S[`${of("challenge")[0].id}/relay`];
await step("guard/replay", async () => genlayerWrite("EXPECTED-replay-judged-dispute", "judge", [first.disputeId, first.listTx, first.disputeTx, first.quoteTx]));

// 6. Unchallenged listings become registered once their window has passed.
for (const c of [...of("unchallenged"), ...of("caught-later")]) {
  await step(`${c.id}/execute`, async () => {
    await waitUntil(S[`${c.id}/list`].tx, Number(dep.challengePeriodSeconds), `the challenge window of ${c.id}`);
    return execute(publisher, S[`${c.id}/list`].itemId);
  });
}

// 7. A listed skill is caught later: a hunter asks for its removal with the quote, and the
//    publisher's side disputes that.
for (const c of of("caught-later")) {
  await step(`${c.id}/removal-request`, () => requestRemoval(hunter, S[`${c.id}/list`].itemId, evidenceUri(c)));
  await step(`${c.id}/removal-challenge`, () => challenge(publisher, S[`${c.id}/list`].itemId, ""));
  await step(`${c.id}/removal-relay`, () => relay(S[`${c.id}/removal-challenge`].tx as Hex, `${c.id}-removal`, S[`${c.id}/removal-relay-attempt`]?.judge));
}

// 8. A removal request against a clean, listed skill fails.
for (const c of all.filter((c) => c.then === "false-removal")) {
  if ((await status(S[`${c.id}/list`].itemId)) !== "registered" && !S[`${c.id}/removal-request`]) continue;
  await step(`${c.id}/removal-request`, () => requestRemoval(hunter, S[`${c.id}/list`].itemId, evidenceUri(c)));
  await step(`${c.id}/removal-challenge`, () => challenge(publisher, S[`${c.id}/list`].itemId, ""));
  await step(`${c.id}/removal-relay`, () => relay(S[`${c.id}/removal-challenge`].tx as Hex, `${c.id}-removal`));
}

// 9. The dispute nobody judged is closed by an outsider after the deadline: refuse to rule.
for (const c of of("timeout")) {
  await step(`${c.id}/refuse`, async () => {
    await waitUntil(S[`${c.id}/challenge`].tx, Number(dep.rulingTimeoutSeconds), "the ruling deadline");
    const hash = await hunter.writeContract({ address: dep.arbitrator, abi: artifact("GenLayerArbitrator").abi, functionName: "refuse", args: [BigInt(S[`${c.id}/challenge`].disputeId)] });
    await pub.waitForTransactionReceipt({ hash, timeout: 300_000 });
    return { tx: hash };
  });
}

// 10. Where every listing ended up, read back from Curate.
await sleep(15_000);
const rows: Record<string, unknown> = {};
for (const c of all) rows[c.id] = { status: await status(S[`${c.id}/list`].itemId), finding: S[`${c.id}/relay`]?.verdict?.finding ?? S[`${c.id}/removal-relay`]?.verdict?.finding ?? null };
console.table(rows);
