#!/usr/bin/env tsx
// Confirms that every uploaded item file's IPFS address can be recomputed from the skill version
// alone (no network): the checker relies on this to find a listing without an index.
import { readFileSync } from "node:fs";
import { cases, ipfsAddress, itemFile, sha256, stable } from "./kleros-lib";

const plan = JSON.parse(readFileSync("kleros/build/files.json", "utf8"));
const ipfs = JSON.parse(readFileSync("deployments/ipfs.json", "utf8"));
let ok = 0;
for (const c of cases()) {
  const data = stable(itemFile(c, plan.fixturesCommit));
  const real = ipfs.bySha[sha256(data)]?.cid;
  if (ipfsAddress(data) === real) ok++;
  else console.log(`MISMATCH ${c.id}: ${ipfsAddress(data)} vs ${real}`);
}
console.log(`${ok} of ${cases().length} item addresses recomputed from the skill version`);
process.exitCode = ok === cases().length ? 0 : 1;
