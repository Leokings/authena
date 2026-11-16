#!/usr/bin/env tsx
/**
 * Uploads the list's files to IPFS through Kleros's own gateway.
 *
 * THIS SPENDS REAL MONEY: $0.01 in USDC on Base mainnet per file, paid from the wallet whose key is
 * in the environment (AUTHENA_SIGNER_KEY, or AGENTSCORE_SIGNER_KEY). Run it yourself:
 *
 *   npx tsx --env-file=../agentscore/.env scripts/kleros-upload.ts
 *
 * It is safe to run again: a file already uploaded (same bytes) is never paid for twice. Results
 * are kept in deployments/ipfs.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { createPublicClient, erc20Abi, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { createSigner, wrapFetchWithPayment } from "x402-fetch";
import { metaEvidence, sha256, stable } from "./kleros-lib";
import { signerKey } from "./lib";

const GATEWAY = process.env.GATEWAY_URL ?? "https://kleros-ipfs-gateway.fly.dev";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const; // USDC on Base
const PRICE = 0.01;
const OUT = "deployments/ipfs.json";

type Uploaded = { name: string; cid: string; url: string };
const plan: { fixturesCommit: string; items: Record<string, string>; evidence: Record<string, string>; files: { name: string; path: string; operation: string; sha256: string }[] } = JSON.parse(
  readFileSync("kleros/build/files.json", "utf8"),
);
const state: { fixturesCommit: string; bySha: Record<string, Uploaded>; list?: Record<string, string> } = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { fixturesCommit: plan.fixturesCommit, bySha: {} };
state.fixturesCommit = plan.fixturesCommit;
const save = () => {
  mkdirSync("deployments", { recursive: true });
  writeFileSync(OUT, JSON.stringify(state, null, 2) + "\n");
};

const key = signerKey();
const payer = privateKeyToAccount(key).address;
const balance = await createPublicClient({ chain: base, transport: http() }).readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [payer] });
const fixed = [
  { name: "policy.pdf", path: "kleros/policy.pdf", operation: "meta-evidence" },
  { name: "logo.png", path: "kleros/logo.png", operation: "meta-evidence" },
];
const pending = [...fixed, ...plan.files].filter((f) => !state.bySha[sha256(readFileSync(f.path))]).length;
// The two list descriptions are built from the policy and logo addresses, so they are counted apart.
const estimate = (pending + (state.list ? 0 : 2)) * PRICE;
console.log(`payer ${payer} holds ${formatUnits(balance, 6)} USDC on Base. About ${pending + (state.list ? 0 : 2)} uploads to go, $${estimate.toFixed(2)}.`);
if (Number(formatUnits(balance, 6)) < estimate) {
  console.error(`Not enough USDC. Send at least $${estimate.toFixed(2)} of USDC on Base to ${payer} and run this again.`);
  process.exit(1);
}

const fetchWithPay = wrapFetchWithPayment(fetch, await createSigner("base", key));

async function upload(name: string, bytes: Buffer, operation: string): Promise<Uploaded> {
  const hash = sha256(bytes);
  if (state.bySha[hash]) return state.bySha[hash];
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/octet-stream" }), name);
  const res = await fetchWithPay(`${GATEWAY}/upload-to-ipfs?operation=${encodeURIComponent(operation)}`, { method: "POST", body: form });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name}: gateway answered ${res.status}: ${text.slice(0, 200)}`);
  const body = JSON.parse(text) as { cids: string[]; urls?: string[]; inconsistentCids?: string[] };
  if (!body.cids?.[0]) throw new Error(`${name}: the gateway returned no CID`);
  if (body.inconsistentCids?.length) console.warn(`warning: ${name}: inconsistent CIDs ${JSON.stringify(body.inconsistentCids)}`);
  state.bySha[hash] = { name, cid: body.cids[0], url: body.urls?.[0] ?? `https://cdn.kleros.link${body.cids[0]}` };
  save();
  console.log(`✓ ${name}  ${state.bySha[hash].cid}`);
  return state.bySha[hash];
}
const uploadFile = (f: { name: string; path: string; operation: string }) => upload(basename(f.name), readFileSync(f.path), f.operation);

// 1. Policy and logo first: the list descriptions point at them.
const policy = await uploadFile(fixed[0]);
const logo = await uploadFile(fixed[1]);

// 2. The two list descriptions (adding a skill, removing a skill).
mkdirSync("kleros/build", { recursive: true });
const descriptions: Record<string, string> = {};
for (const kind of ["registration", "clearing"] as const) {
  const content = stable(metaEvidence(kind, policy.cid, logo.cid));
  const name = kind === "registration" ? "reg-meta-evidence.json" : "clr-meta-evidence.json";
  writeFileSync(`kleros/build/${name}`, content);
  descriptions[kind] = (await upload(name, Buffer.from(content), "meta-evidence")).cid;
}
state.list = { policy: policy.cid, logo: logo.cid, registrationMetaEvidence: descriptions.registration, clearingMetaEvidence: descriptions.clearing };
save();

// 3. One file per listing and per accusation.
for (const f of plan.files) await uploadFile(f);

console.log(`\nDone. ${Object.keys(state.bySha).length} files are on IPFS. Addresses are in ${OUT}.`);
