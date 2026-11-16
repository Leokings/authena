#!/usr/bin/env tsx
/**
 * Creates the two demo wallets (publisher, hunter) in data/demo-wallets.json (gitignored) and
 * tops each up from the signer. Keys are never printed.
 *
 *   npx tsx --env-file=../agentscore/.env scripts/demo-wallets.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { pub, signerKey, wallet, WALLETS } from "./lib";

const TARGET = parseEther("0.02");
const roles = ["publisher", "hunter"] as const;

mkdirSync("data", { recursive: true });
const wallets: Record<string, { key: `0x${string}`; address: string }> = existsSync(WALLETS) ? JSON.parse(readFileSync(WALLETS, "utf8")) : {};
for (const role of roles) {
  if (!wallets[role]) {
    const key = generatePrivateKey();
    wallets[role] = { key, address: privateKeyToAccount(key).address };
  }
}
writeFileSync(WALLETS, JSON.stringify(wallets, null, 2) + "\n");

const signer = wallet(signerKey());
for (const role of roles) {
  const address = wallets[role].address as `0x${string}`;
  const balance = await pub.getBalance({ address });
  if (balance < TARGET / 2n) {
    const hash = await signer.sendTransaction({ to: address, value: TARGET - balance });
    await pub.waitForTransactionReceipt({ hash });
  }
  console.log(`${role} ${address} ${(await pub.getBalance({ address })).toString()} wei`);
}
