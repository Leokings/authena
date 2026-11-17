#!/usr/bin/env node
// Builds docs/SUBMISSION.md (the Portal fields and evidence links) from the release manifest,
// and checks each field against the Portal's length limits.
//   node scripts/submission.mjs
import { readFileSync, writeFileSync } from "node:fs";

const m = JSON.parse(readFileSync("deployments/release-manifest.json", "utf8"));
const commit = m.genlayer.contract.git_commit;
const head = process.env.HEAD_COMMIT;
const pin = head ?? "main";
const c = (id) => m.cases.find((x) => x.id === id);
const fix = m.ipfs.fixtures_commit;
const SITE = "https://authena-sepia.vercel.app";
const REPO = "https://github.com/Leokings/authena";
const proof = m.genlayer_steps.filter((s) => s.counts_as_proof).length;

const oneLiner =
  "A Kleros Curate list of AI-agent skills that are safe to install. Anyone can challenge one by quoting a bad line; GenLayer validators judge it and Kleros pays the winner.";

const description = [
  "An agent obeys every skill it installs, so one hidden line can make it leak keys or move funds. Authena is a Kleros Curate list of skill versions, each pinned to a commit, that a publisher has staked a deposit on being clean.",
  "Anyone can challenge by quoting the bad line. The list names a GenLayer contract as its arbitrator: validators read the listing and the challenge from Sepolia, check each IPFS file against its address, fetch the skill from GitHub, confirm the quote is in it, and answer one question: does it tell the agent to do something its stated purpose does not need? Code maps the answer to Curate's ruling and Kleros pays the winner.",
  `Live: ${m.cases.length} skills on one list. Hidden leaks, a token approval and a remote loader were busted; honest look-alikes stayed listed. The list shows on Kleros's website.`,
  "Limits: test networks; one relay key carries rulings to Sepolia.",
].join(" ");

const howTo = [
  ["Check a skill", `Open ${SITE} and paste github.com/Leokings/authena/tree/${fix}/fixtures/skills/poisoned-do-not-install, then press Check.`],
  ["See it on Kleros", `Open ${m.sepolia.curate_url}. Turn the NSFW filter off to see every item. Open the rejected poisoned-do-not-install item: the ruling, the quoted line and the dates.`],
  ["See the judgment", `Open ${c("poisoned-uploader").registration.judge_tx}. Execution result SUCCESS, return value "MALICIOUS".`],
  ["Check from the command line", `Clone ${REPO}, run npm install, then: npx tsx scripts/authena.ts check Leokings/authena ${fix} fixtures/skills/file-uploader (exit 0), and the same with fixtures/skills/pdf-summarizer (exit 1).`],
  ["Reproduce", "Run npm test (105 contract tests, 8 adapter tests). The README lists the deploy and live-demo commands."],
];

const expected = `The site stamps the poisoned skill BUSTED and quotes the planted line. On Kleros the item is Rejected with "The arbitrator ruled in favor of the challenger". The GenLayer transaction is FINALIZED and returns MALICIOUS. check exits 0 for file-uploader (registered, BENIGN) and 1 for pdf-summarizer (caught after listing). The manifest shows ${m.cases.filter((x) => x.as_expected).length}/${m.cases.length} cases as designed and ${proof}/${m.genlayer_steps.length} GenLayer steps as proof.`;

const evidence = [
  [`${REPO}`, "Repository"],
  [`${REPO}/blob/${commit}/contracts/skill_court.py`, "Judge contract at the deployed commit"],
  [`${REPO}/blob/${pin}/evm/GenLayerArbitrator.sol`, "Sepolia arbitrator adapter"],
  [`${REPO}/blob/${pin}/deployments/release-manifest.json`, "Release manifest: every transaction, vote and read-back"],
  [m.sepolia.curate_url, "The list on Kleros Curate"],
  [m.genlayer.contract.explorer, "Judge contract on the GenLayer explorer"],
  [c("poisoned-uploader").registration.judge_tx, "Judgment: poisoned uploader, MALICIOUS"],
  [c("file-uploader").registration.judge_tx, "Judgment: false alarm, BENIGN"],
  [c("sneaky-token-approval").registration.judge_tx, "Judgment: sneaky token approval, MALICIOUS"],
  [c("pdf-summarizer").removal.judge_tx, "Judgment: removal of a listed skill, MALICIOUS"],
  [c("markdown-tidy").registration.judge_tx, "Code decides: quote not in file"],
  ...m.genlayer_steps.filter((s) => s.expected_failure).map((s) => [s.explorer, `Expected failure: ${s.expected_error.replace("[EXPECTED] ", "")}`]),
  [c("poisoned-uploader").registration.ruling_tx, "Ruling paid on Sepolia (poisoned uploader)"],
  [`${SITE}/video/authena.mp4`, "45-second video"],
  [`${SITE}`, "Live site"],
];

const limits = { "One-liner": [oneLiner, 180], Description: [description, 1000], "Expected verification outcome": [expected, 500] };
const problems = Object.entries(limits).filter(([, [t, max]]) => t.length > max).map(([k, [t, max]]) => `${k}: ${t.length}/${max}`);

const md = `# Portal submission (draft — not submitted)

Mission: **Internet Court: Partner Demo Lab** · Type: Projects · Partner: **Kleros**

| Field | Value |
|---|---|
| Project name | Authena |
| Primary tag | AI & Agents |
| Website | ${SITE} |
| GitHub | ${REPO} |
| Contract link | ${m.genlayer.contract.explorer} |
| Demo URL (YouTube or X) | _the post with the video_ |

## One-liner (${oneLiner.length}/180)

${oneLiner}

## Description (${description.length}/1000)

${description}

## How-to

${howTo.map(([h, t], i) => `${i + 1}. **${h}.** ${t}`).join("\n")}

## Expected verification outcome (${expected.length}/500)

${expected}

## Evidence

${evidence.map(([u, t]) => `- ${t}: ${u}`).join("\n")}
`;
writeFileSync("docs/SUBMISSION.md", md);
console.log(problems.length ? `TOO LONG: ${problems.join(", ")}` : `docs/SUBMISSION.md written; one-liner ${oneLiner.length}/180, description ${description.length}/1000, expected ${expected.length}/500, ${evidence.length} evidence links`);
