#!/usr/bin/env tsx
// Prints how one demo listing's ruling is recorded on Curate and on the adapter.
//   npx tsx scripts/inspect-ruling.ts <case-id>
import { readFileSync } from "node:fs";
import { parseAbi } from "viem";
import { pub } from "./lib";

const man = JSON.parse(readFileSync("deployments/release-manifest.json", "utf8"));
const c = man.cases.find((x: any) => x.id === (process.argv[2] ?? "poisoned-uploader"));
const abi = parseAbi([
  "function getRequestInfo(bytes32,uint256) view returns (bool disputed, uint256 disputeID, uint256 submissionTime, bool resolved, address[3] parties, uint256 numberOfRounds, uint8 ruling, address requestArbitrator, bytes requestArbitratorExtraData, uint256 metaEvidenceID)",
  "function currentRuling(uint256) view returns (uint256)",
  "function disputeStatus(uint256) view returns (uint8)",
]);
const r = await pub.readContract({ address: man.sepolia.registry, abi, functionName: "getRequestInfo", args: [c.item_id, 0n] });
console.log(`curate request: dispute ${r[1]}, resolved ${r[3]}, ruling ${r[6]}, rounds ${r[5]}`);
const ruling = await pub.readContract({ address: man.sepolia.arbitrator, abi, functionName: "currentRuling", args: [r[1]] });
const status = await pub.readContract({ address: man.sepolia.arbitrator, abi, functionName: "disputeStatus", args: [r[1]] });
console.log(`adapter: currentRuling ${ruling}, disputeStatus ${status}`);
