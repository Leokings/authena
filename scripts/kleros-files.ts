#!/usr/bin/env tsx
/**
 * Writes the files Kleros Curate's website needs for the demo list into kleros/build/:
 * one item file per listing and one evidence file per distinct accusation. Free; uploads nothing.
 *
 *   npx tsx scripts/kleros-files.ts <fixtures-commit>
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { cases, evidenceFile, itemFile, sha256, stable } from "./kleros-lib";

const fix = process.argv[2];
if (!/^[0-9a-f]{40}$/.test(fix ?? "")) {
  console.error("usage: kleros-files.ts <40-character commit of this repo that holds the fixtures>");
  process.exit(1);
}
for (const f of ["kleros/policy.pdf", "kleros/logo.png"]) {
  if (!existsSync(f)) throw new Error(`${f} is missing (python scripts/policy-pdf.py; the logo is committed)`);
}

rmSync("kleros/build", { recursive: true, force: true });
mkdirSync("kleros/build/items", { recursive: true });
mkdirSync("kleros/build/evidence", { recursive: true });

type Entry = { name: string; path: string; operation: string; sha256: string };
const files: Entry[] = [];
const add = (name: string, path: string, operation: string, content: string) => {
  writeFileSync(path, content);
  files.push({ name, path, operation, sha256: sha256(content) });
};

const items: Record<string, string> = {}; // case id -> file name
const evidence: Record<string, string> = {}; // case id -> file name (shared when the accusation is identical)
const bySha: Record<string, string> = {};
for (const c of cases()) {
  const name = `item-${c.id}.json`;
  add(name, `kleros/build/items/${name}`, "evidence", stable(itemFile(c, fix)));
  items[c.id] = name;
  if (!c.quote) continue;
  const content = stable(evidenceFile(c.quote));
  const hash = sha256(content);
  if (!bySha[hash]) {
    bySha[hash] = `evidence-${hash.slice(0, 10)}.json`;
    add(bySha[hash], `kleros/build/evidence/${bySha[hash]}`, "evidence", content);
  }
  evidence[c.id] = bySha[hash];
}

writeFileSync("kleros/build/files.json", JSON.stringify({ fixturesCommit: fix, items, evidence, files }, null, 2) + "\n");
// Two list files (policy, logo) and two descriptions are added by the upload step.
console.log(`${files.length} files written to kleros/build (${Object.keys(items).length} items, ${Object.keys(bySha).length} evidence).`);
console.log(`With the policy, the logo and the two list descriptions that is ${files.length + 4} uploads, about $${((files.length + 4) * 0.01).toFixed(2)} in USDC on Base.`);
