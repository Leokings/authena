#!/usr/bin/env tsx
/**
 * Deploys the Sepolia side of Authena: the GenLayerArbitrator adapter, then a Kleros Curate list
 * (from Kleros's own LightGTCRFactory) that names the adapter as its judge.
 *
 *   npm run compile
 *   npx tsx --env-file=../agentscore/.env scripts/deploy-sepolia.ts
 *
 * Writes deployments/sepolia.json. Refuses to run twice unless --force is passed.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { decodeEventLog, parseEther, zeroAddress } from "viem";
import { artifact, DEPLOYMENT, explorerTx, FACTORY, factoryAbi, pub, signerKey, wallet } from "./lib";

const DEPOSIT = parseEther("0.001"); // the same on both sides, so "refuse to rule" returns each side its own
const CHALLENGE_PERIOD = 600n; // 10 minutes, for a demo list
const RULING_TIMEOUT = 1800n; // after 30 minutes without a ruling anyone can close the dispute
const ARBITRATION_FEE = 0n;
const POLICY = "https://github.com/Leokings/authena/blob/main/docs/POLICY.md";

if (existsSync(DEPLOYMENT) && !process.argv.includes("--force")) {
  console.error(`${DEPLOYMENT} already exists. Pass --force to deploy a new list.`);
  process.exit(1);
}

const w = wallet(signerKey());
const deployer = w.account.address;
console.log(`deployer ${deployer}, balance ${(await pub.getBalance({ address: deployer })) / 10n ** 14n / 10000n} ETH (approx.)`);

const arb = artifact("GenLayerArbitrator");
const arbTx = await w.deployContract({ abi: arb.abi, bytecode: arb.bytecode, args: [deployer, ARBITRATION_FEE, RULING_TIMEOUT] });
const arbReceipt = await pub.waitForTransactionReceipt({ hash: arbTx });
const arbitrator = arbReceipt.contractAddress!;
console.log(`arbitrator ${arbitrator}  ${explorerTx(arbTx)}`);

const listTx = await w.writeContract({
  address: FACTORY,
  abi: factoryAbi,
  functionName: "deploy",
  args: [
    arbitrator,
    "0x",
    zeroAddress, // no connected list
    POLICY, // registration policy
    POLICY, // removal policy
    deployer, // governor
    [DEPOSIT, DEPOSIT, DEPOSIT, DEPOSIT], // submission, removal, submission challenge, removal challenge
    CHALLENGE_PERIOD,
    [10000n, 10000n, 20000n], // shared, winner, loser appeal multipliers (appeals are off)
    zeroAddress, // nobody can add items without a deposit
  ],
});
const listReceipt = await pub.waitForTransactionReceipt({ hash: listTx });
let registry: `0x${string}` | undefined;
for (const log of listReceipt.logs) {
  if (log.address.toLowerCase() !== FACTORY.toLowerCase()) continue;
  try {
    registry = decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics }).args._address;
  } catch {}
}
if (!registry) throw new Error("the factory did not report a new list");
console.log(`registry   ${registry}  ${explorerTx(listTx)}`);

mkdirSync("deployments", { recursive: true });
writeFileSync(
  DEPLOYMENT,
  JSON.stringify(
    {
      network: "sepolia",
      chainId: 11155111,
      factory: FACTORY,
      arbitrator,
      registry,
      deployer,
      relayer: deployer,
      arbitratorDeployTx: arbTx,
      registryDeployTx: listTx,
      fromBlock: arbReceipt.blockNumber.toString(),
      depositWei: DEPOSIT.toString(),
      arbitrationFeeWei: ARBITRATION_FEE.toString(),
      challengePeriodSeconds: Number(CHALLENGE_PERIOD),
      rulingTimeoutSeconds: Number(RULING_TIMEOUT),
      policy: POLICY,
      arbitratorSource: "evm/GenLayerArbitrator.sol",
      compiler: (arb as any).compiler,
    },
    null,
    2,
  ) + "\n",
);
console.log(`wrote ${DEPLOYMENT}`);
