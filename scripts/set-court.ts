#!/usr/bin/env tsx
// Records the GenLayer judge's address on the Sepolia adapter (once).
//   npx tsx --env-file=../agentscore/.env scripts/set-court.ts
import { readFileSync } from "node:fs";
import { artifact, deployment, explorerTx, pub, signerKey, wallet } from "./lib";

const d = deployment();
const arb = artifact("GenLayerArbitrator");
const court = readFileSync("deployments/studionet/CONTRACT", "utf8").trim();
const current = (await pub.readContract({ address: d.arbitrator, abi: arb.abi, functionName: "court" })) as string;
if (current) {
  console.log(`already set: ${current}`);
} else {
  const hash = await wallet(signerKey()).writeContract({ address: d.arbitrator, abi: arb.abi, functionName: "setCourt", args: [court] });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`court set to ${court}  ${explorerTx(hash)}`);
}
