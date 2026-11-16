#!/usr/bin/env node
// Fills the README's live sections from deployments/release-manifest.json.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const m = JSON.parse(readFileSync("deployments/release-manifest.json", "utf8"));
let readme = readFileSync("README.md", "utf8");
const set = (tag, content) => {
  const paired = new RegExp(`<!--${tag}-->[\s\S]*?<!--/${tag}-->`);
  const block = `<!--${tag}-->${content}<!--/${tag}-->`;
  readme = paired.test(readme) ? readme.replace(paired, block) : readme.replace(`<!--${tag}-->`, block);
};
const link = (text, href) => (href ? `[${text}](${href})` : "");
const outcome = (c) => {
  const v = c.readback.verdict;
  if (v?.judged) return `\`${v.finding}\` (${v.judged_by === "code" ? "code" : "validators"})`;
  return c.sepolia.refuse_tx ? "no ruling in time" : "not challenged";
};

set("COURT", `[\`${m.genlayer.contract.address}\`](${m.genlayer.contract.explorer})`);
set("REGISTRY", `[\`${m.sepolia.registry}\`](https://sepolia.etherscan.io/address/${m.sepolia.registry})`);
set("ARBITRATOR", `[\`${m.sepolia.arbitrator}\`](https://sepolia.etherscan.io/address/${m.sepolia.arbitrator})`);
set(
  "CASES",
  "\n| Case | Outcome | On the list? | Transactions |\n|---|---|---|---|\n" +
    m.cases
      .map((c) => {
        const txs = [link("listed", c.sepolia.list_tx), link("challenged", c.sepolia.challenge_tx), link("judged", c.genlayer?.judge_tx), link("ruled", c.sepolia.ruling_tx), link("registered", c.sepolia.execute_tx), link("closed", c.sepolia.refuse_tx)].filter(Boolean).join(" · ");
        return `| ${c.shows} | ${outcome(c)} | ${c.readback.curate_status === "registered" ? "Yes" : "No"} | ${txs} |`;
      })
      .join("\n") +
    "\n",
);
set("GUARDS", m.genlayer_steps.filter((s) => s.expected_failure).map((s) => link(`\`${s.expected_error.replace("[EXPECTED] ", "")}\``, s.explorer)).join(", ") + ".");
if (existsSync("deployments/judgment-tests.json")) {
  const t = JSON.parse(readFileSync("deployments/judgment-tests.json", "utf8"));
  set(
    "TESTS",
    "\n| Test skill | Why | Expected | Got | Links |\n|---|---|---|---|---|\n" +
      t.results.map((r) => `| \`${r.id}\` | ${r.why.replaceAll("|", "\\|")} | \`${r.expected}\` | \`${r.got}\`${r.pass ? "" : " ✗"} | ${[link("judged", r.genlayer_tx), link("ruled", r.ruling_tx)].filter(Boolean).join(" · ")} |`).join("\n") +
      `\n\n${t.results.filter((r) => r.pass).length} of ${t.results.length} as expected.\n`,
  );
}
writeFileSync("README.md", readme);
console.log("README updated");
