#!/usr/bin/env node
// Fills the README's live sections from deployments/release-manifest.json.
import { readFileSync, writeFileSync } from "node:fs";

const m = JSON.parse(readFileSync("deployments/release-manifest.json", "utf8"));
let readme = readFileSync("README.md", "utf8");
const set = (tag, content) => {
  const paired = new RegExp(`<!--${tag}-->[\\s\\S]*?<!--/${tag}-->`);
  const block = `<!--${tag}-->${content}<!--/${tag}-->`;
  readme = paired.test(readme) ? readme.replace(paired, block) : readme.replace(`<!--${tag}-->`, block);
};
const link = (text, href) => (href ? `[${text}](${href})` : "");
const cell = (text) => String(text).replaceAll("|", "\\|");
const outcome = (c) => {
  const parts = [];
  const reg = c.registration?.verdict;
  const rem = c.removal?.verdict;
  if (reg?.judged) parts.push(`\`${reg.finding}\` (${reg.judged_by === "code" ? "code" : "validators"})`);
  if (c.sepolia.execute_tx) parts.push("registered unchallenged");
  if (rem?.judged) parts.push(`removal: \`${rem.finding}\` (${rem.judged_by === "code" ? "code" : "validators"})`);
  if (c.sepolia.refuse_tx) parts.push("no ruling in time");
  return parts.join(", then ");
};

set("COURT", `[\`${m.genlayer.contract.address}\`](${m.genlayer.contract.explorer})`);
set("REGISTRY", `[\`${m.sepolia.registry}\`](https://sepolia.etherscan.io/address/${m.sepolia.registry})`);
set("ARBITRATOR", `[\`${m.sepolia.arbitrator}\`](https://sepolia.etherscan.io/address/${m.sepolia.arbitrator})`);
set("CURATE", `[curate.kleros.io](${m.sepolia.curate_url})`);
set(
  "CASES",
  "\n| Skill | What happened | Outcome | On the list? | Transactions |\n|---|---|---|---|---|\n" +
    m.cases
      .map((c) => {
        const txs = [
          link("listed", c.sepolia.list_tx),
          link("challenged", c.sepolia.challenge_tx),
          link("judged", c.registration?.judge_tx),
          link("ruled", c.registration?.ruling_tx),
          link("registered", c.sepolia.execute_tx),
          link("removal asked", c.sepolia.removal_request_tx),
          link("removal judged", c.removal?.judge_tx),
          link("removal ruled", c.removal?.ruling_tx),
          link("closed", c.sepolia.refuse_tx),
        ]
          .filter(Boolean)
          .join(" · ");
        return `| ${cell(c.title)} | ${cell(c.why)} | ${outcome(c)} | ${c.final_status === "registered" ? "Yes" : "No"} | ${txs} |`;
      })
      .join("\n") +
    `\n\n${m.cases.filter((c) => c.as_expected).length} of ${m.cases.length} ended as designed.\n`,
);
set("GUARDS", m.genlayer_steps.filter((s) => s.expected_failure).map((s) => link(`\`${s.expected_error.replace("[EXPECTED] ", "")}\``, s.explorer)).join(", ") + ".");
writeFileSync("README.md", readme);
console.log("README updated");
