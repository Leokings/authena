#!/usr/bin/env node
// Builds site/data.json: the release manifest plus short "case file" cards for the page.
import { readFileSync, writeFileSync } from "node:fs";

const m = JSON.parse(readFileSync("deployments/release-manifest.json", "utf8"));
const last = (path) => (path || "").split("/").filter(Boolean).pop() ?? "";

const cards = m.cases.map((c) => {
  const reg = c.registration?.verdict?.judged ? c.registration.verdict.finding : null;
  const rem = c.removal?.verdict?.judged ? c.removal.verdict.finding : null;
  let tone = "hm";
  let stamp = "Pending";
  if (c.flow === "unchallenged") [tone, stamp] = ["ok", "Listed"];
  else if (c.flow === "timeout") [tone, stamp] = ["hm", "Timed out"];
  else if (c.flow === "caught-later") [tone, stamp] = rem === "MALICIOUS" ? ["bad", "Busted"] : ["hm", rem ?? "Pending"];
  else if (reg === "MALICIOUS") [tone, stamp] = ["bad", "Busted"];
  else if (reg === "BENIGN") [tone, stamp] = ["ok", "Cleared"];
  else if (reg) [tone, stamp] = ["hm", "Thrown out"];
  const l = c.listing;
  const pinned = /^[0-9a-f]{40}$/.test(l.commit);
  return {
    id: c.id,
    tone,
    stamp,
    title: c.title,
    who: `${l.repo} · ${last(l.folder)}`,
    short: last(l.folder),
    quote: c.quote,
    listed: c.final_status === "registered",
    link: pinned ? `github.com/${l.repo}/tree/${l.commit}/${l.folder}` : null,
    links: [
      ["listed", c.sepolia.list_tx],
      ["challenged", c.sepolia.challenge_tx],
      ["judged", c.registration?.judge_tx],
      ["paid", c.registration?.ruling_tx],
      ["registered", c.sepolia.execute_tx],
      ["removal asked", c.sepolia.removal_request_tx],
      ["removal judged", c.removal?.judge_tx],
      ["removal paid", c.removal?.ruling_tx],
      ["closed", c.sepolia.refuse_tx],
    ],
  };
});
writeFileSync("site/data.json", JSON.stringify({ ...m, cards }, null, 2) + "\n");
console.log(`site/data.json: ${cards.length} cards`);
