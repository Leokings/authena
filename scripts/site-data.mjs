#!/usr/bin/env node
// Builds site/data.json: the release manifest plus short "case file" cards for the page.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const m = JSON.parse(readFileSync("deployments/release-manifest.json", "utf8"));
const tests = existsSync("deployments/judgment-tests.json") ? JSON.parse(readFileSync("deployments/judgment-tests.json", "utf8")) : null;
const quotes = Object.fromEntries(JSON.parse(readFileSync("fixtures/cases.json", "utf8")).map((c) => [c.id, c]));

const TITLES = {
  "A-real-clean-unchallenged": "Kleros's own Curate skill",
  "B-poisoned": "The poisoned uploader",
  "C-clean-false-challenge": "A false alarm",
  "D-fabricated-quote": "A made-up quote",
  "E-not-pinned": "Pinned to a branch",
  "F-no-ruling-in-time": "Nobody ruled in time",
  "honest-cli-installer": "Installs its own tool",
  "honest-payments": "Pays what you confirm",
  "honest-security-notes": "Only describes attacks",
  "sneaky-transcript-leak": "Leaks your chat",
  "sneaky-token-approval": "Sneaks a token approval",
  "sneaky-remote-loader": "Obeys a remote file",
  "removal-caught-later": "Listed, then caught",
  "removal-false": "A removal that failed",
};
const stampFor = (finding, fallback) =>
  finding === "MALICIOUS" ? ["bad", "Busted"] : finding === "BENIGN" ? ["ok", "Cleared"] : finding ? ["hm", "Thrown out"] : fallback;
const last = (path) => (path || "").split("/").filter(Boolean).pop() ?? "";
const checkable = (l) => (l && /^[0-9a-f]{40}$/.test(l.commit) && !/^\/|\/$/.test(l.path) ? `github.com/${l.repo}/tree/${l.commit}/${l.path}` : null);

const cards = [];
for (const c of m.cases) {
  const v = c.readback.verdict?.judged ? c.readback.verdict : null;
  const l = c.listing ? JSON.parse(c.listing) : null;
  const [tone, stamp] = stampFor(v?.finding, c.sepolia.refuse_tx ? ["hm", "Timed out"] : ["ok", "Listed"]);
  cards.push({
    id: c.id,
    tone,
    stamp,
    title: TITLES[c.id] ?? c.shows,
    who: l ? `${l.repo} · ${last(l.path)}` : "",
    short: last(l?.path),
    quote: v?.quote || null,
    link: checkable(l),
    links: [
      ["listed", c.sepolia.list_tx],
      ["challenged", c.sepolia.challenge_tx],
      ["judged", c.genlayer?.judge_tx],
      ["paid", c.sepolia.ruling_tx],
      ["registered", c.sepolia.execute_tx],
      ["closed", c.sepolia.refuse_tx],
    ],
  });
}
for (const t of tests?.results ?? []) {
  const [tone, stamp] = stampFor(t.got, ["hm", "Pending"]);
  const base = t.id.startsWith("removal-") ? (t.id === "removal-false" ? "honest-payments" : "sneaky-transcript-leak") : t.id;
  cards.push({
    id: t.id,
    tone,
    stamp,
    title: TITLES[t.id] ?? t.id,
    who: `test · ${base}${t.request_type === "removal" ? " · removal" : ""}`,
    short: t.id,
    quote: quotes[base]?.quote ?? null,
    link: null,
    links: [
      ["judged", t.genlayer_tx],
      ["paid", t.ruling_tx],
    ],
    pass: t.pass,
  });
}
writeFileSync("site/data.json", JSON.stringify({ ...m, tests: tests?.results ?? [], cards }, null, 2) + "\n");
console.log(`site/data.json: ${cards.length} cards`);
