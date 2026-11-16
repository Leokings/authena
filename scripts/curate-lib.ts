// Actions on the Authena Curate list (Sepolia) and the relay that carries disputes to GenLayer.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { decodeEventLog, keccak256, toHex, type Hex, type WalletClient } from "viem";
import { artifact, deployment, pub, registryAbi, signerKey, STATUS, wallet } from "./lib";

export const COURT_FILE = "deployments/studionet/CONTRACT";
export const court = () => readFileSync(COURT_FILE, "utf8").trim() as Hex;

export const itemIdOf = (listing: string) => keccak256(toHex(listing));
export const listingOf = (repo: string, commit: string, path: string) => JSON.stringify({ repo, commit, path });

type W = WalletClient & { account: { address: Hex } };

async function send(w: W, functionName: string, args: unknown[], value?: bigint) {
  const { registry } = deployment();
  const hash = await (w as any).writeContract({ address: registry, abi: registryAbi, functionName, args, value });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${functionName} reverted: ${hash}`);
  return receipt;
}

const read = (functionName: string, args: unknown[] = []) => pub.readContract({ address: deployment().registry, abi: registryAbi, functionName, args } as any) as Promise<any>;

/** Lists a skill version with the submission deposit. */
export async function list(w: W, listing: string) {
  const receipt = await send(w, "addItem", [listing], (await read("submissionBaseDeposit")) + BigInt(deployment().arbitrationFeeWei as string));
  return { tx: receipt.transactionHash, itemId: itemIdOf(listing) };
}

/** Challenges a pending listing (or a pending removal) with an accusation. Returns the dispute ID. */
export async function challenge(w: W, itemId: Hex, accusation: string) {
  const [status] = await read("getItemInfo", [itemId]);
  const base = await read(status === 2 ? "submissionChallengeBaseDeposit" : "removalChallengeBaseDeposit");
  const receipt = await send(w, "challengeRequest", [itemId, accusation], base + BigInt(deployment().arbitrationFeeWei as string));
  return { tx: receipt.transactionHash, disputeId: disputeIn(receipt).disputeId };
}

/** Asks to remove a listed skill, quoting the passage. */
export async function requestRemoval(w: W, itemId: Hex, accusation: string) {
  const receipt = await send(w, "removeItem", [itemId, accusation], (await read("removalBaseDeposit")) + BigInt(deployment().arbitrationFeeWei as string));
  return { tx: receipt.transactionHash };
}

/** Finalises an unchallenged request once the challenge window has passed. */
export async function execute(w: W, itemId: Hex) {
  return { tx: (await send(w, "executeRequest", [itemId])).transactionHash };
}

export async function status(itemId: Hex) {
  const [code] = await read("getItemInfo", [itemId]);
  return STATUS[Number(code)];
}

function disputeIn(receipt: { logs: readonly { address: string; data: Hex; topics: readonly Hex[] }[] }) {
  const { registry } = deployment();
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== registry.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: registryAbi, data: log.data, topics: log.topics as any });
      if (ev.eventName === "Dispute") return { disputeId: Number(ev.args._disputeID), group: ev.args._evidenceGroupID, removal: Number(ev.args._metaEvidenceID % 2n) === 1 };
    } catch {}
  }
  throw new Error("no Dispute event in that transaction");
}

async function logsFor(event: "NewItem" | "RequestSubmitted", itemId: Hex) {
  const { registry, fromBlock } = deployment();
  return pub.getContractEvents({ address: registry, abi: registryAbi, eventName: event, args: { _itemID: itemId }, fromBlock: BigInt(fromBlock), toBlock: "latest" } as any) as Promise<any[]>;
}

/** The three Sepolia transactions the GenLayer contract needs for one dispute. */
export async function disputeInputs(disputeTx: Hex) {
  const { registry, arbitrator } = deployment();
  const d = disputeIn(await pub.getTransactionReceipt({ hash: disputeTx }));
  const itemId = (await pub.readContract({ address: registry, abi: registryAbi, functionName: "arbitratorDisputeIDToItemID", args: [arbitrator, BigInt(d.disputeId)] })) as Hex;
  const listTx = (await logsFor("NewItem", itemId))[0]?.transactionHash as Hex;
  if (!listTx) throw new Error("listing transaction not found");
  let quoteTx = disputeTx;
  if (d.removal) {
    const request = (await logsFor("RequestSubmitted", itemId)).find((l) => l.args._evidenceGroupID === d.group);
    if (!request) throw new Error("removal request not found");
    quoteTx = request.transactionHash;
  }
  return { disputeId: d.disputeId, itemId, listTx, disputeTx, quoteTx, requestType: d.removal ? "removal" : "registration" };
}

const genlayer = createClient({ chain: studionet });

export async function verdict(disputeId: number): Promise<any> {
  return genlayer.readContract({ address: court() as any, functionName: "get_verdict", args: [disputeId], jsonSafeReturn: true } as any);
}

/** Sends one write to the GenLayer contract through the CLI and waits for FINALIZED. */
export function genlayerWrite(label: string, method: string, args: (string | number)[]) {
  const out = execFileSync("bash", ["scripts/gl-tx.sh", label, court(), method, ...args.map(String)], { encoding: "utf8", env: { ...process.env, OUT_DIR: "deployments/studionet/receipts" } });
  return JSON.parse(out.trim().split("\n").pop()!) as { label: string; tx?: string; status?: string; leader?: string; agree?: number; disagree?: number; error?: string };
}

/**
 * Carries one Curate dispute to GenLayer and the finalized verdict back.
 * The relay adds nothing of its own: every input is re-read from Sepolia by the validators, and
 * the ruling it submits is the one stored on GenLayer, with that transaction's hash.
 */
export async function relay(disputeTx: Hex, label: string) {
  const { arbitrator } = deployment();
  const inputs = await disputeInputs(disputeTx);
  let v = await verdict(inputs.disputeId);
  let judge: ReturnType<typeof genlayerWrite> | undefined;
  if (!v.judged) {
    judge = genlayerWrite(label, "judge", [inputs.disputeId, inputs.listTx, inputs.disputeTx, inputs.quoteTx]);
    if (judge.status !== "FINALIZED" || judge.leader !== "SUCCESS") return { ...inputs, judge, relayed: false as const };
    v = await verdict(inputs.disputeId);
  }
  const arb = artifact("GenLayerArbitrator");
  const w = wallet(signerKey());
  const genlayerTx = (judge?.tx ?? "0x" + "0".repeat(64)) as Hex;
  const hash = await w.writeContract({ address: arbitrator, abi: arb.abi, functionName: "giveRuling", args: [BigInt(inputs.disputeId), BigInt(v.ruling), genlayerTx] });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  return { ...inputs, judge, verdict: v, relayed: receipt.status === "success", rulingTx: hash, itemStatus: await status(inputs.itemId) };
}

/** Small resumable store for demo runs. */
export function store<T extends object>(path: string, initial: T): { data: T; save: () => void } {
  const data = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : initial;
  return {
    data,
    save: () => {
      mkdirSync(path.split("/").slice(0, -1).join("/") || ".", { recursive: true });
      writeFileSync(path, JSON.stringify(data, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2) + "\n");
    },
  };
}
