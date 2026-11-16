#!/usr/bin/env tsx
/**
 * Authena command line: check, list and challenge agent skills on the Authena Curate list.
 *
 *   npx tsx scripts/authena.ts check <owner/repo> <commit> <folder>
 *   npx tsx scripts/authena.ts verdict <dispute-id>
 *   npx tsx scripts/authena.ts list <owner/repo> <commit> <folder>                      (needs AUTHENA_KEY)
 *   npx tsx scripts/authena.ts challenge <owner/repo> <commit> <folder> <file> "<quote>" (needs AUTHENA_KEY)
 *   npx tsx scripts/authena.ts relay <sepolia-challenge-tx>                              (relayer only)
 *
 * `check` exits 0 only when that exact version is registered, so an agent can gate an install on it.
 * AUTHENA_KEY is a Sepolia private key with a little test ETH. Keep it in a .env file, never in chat.
 */
import type { Hex } from "viem";
import { deployment, explorerTx, wallet } from "./lib";
import { challenge, itemIdOf, list, listingOf, relay, status, verdict } from "./curate-lib";

const [cmd, ...args] = process.argv.slice(2);
const key = () => {
  const k = process.env.AUTHENA_KEY;
  if (!k) throw new Error("Set AUTHENA_KEY in your environment (a Sepolia key with test ETH). Never paste it into chat.");
  return wallet((k.startsWith("0x") ? k : `0x${k}`) as Hex) as any;
};
const canonical = (repo: string, commit: string, folder = "") => {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("commit must be the full 40-character hash, so the content cannot change");
  return listingOf(repo, commit, folder.replace(/^\/+|\/+$/g, ""));
};
const usage = () => {
  console.error("usage: authena check|list|challenge|verdict|relay … (see the header of scripts/authena.ts)");
  process.exit(2);
};

try {
  if (cmd === "check" && args.length >= 2) {
    const listing = canonical(args[0], args[1], args[2]);
    const itemId = itemIdOf(listing);
    const s = await status(itemId);
    console.log(JSON.stringify({ listing: JSON.parse(listing), itemId, status: s, safeToInstall: s === "registered", registry: deployment().registry }, null, 2));
    process.exit(s === "registered" ? 0 : 1);
  } else if (cmd === "verdict" && args.length === 1) {
    console.log(JSON.stringify(await verdict(Number(args[0])), null, 2));
  } else if (cmd === "list" && args.length >= 2) {
    const listing = canonical(args[0], args[1], args[2]);
    const out = await list(key(), listing);
    console.log(JSON.stringify({ ...out, listing: JSON.parse(listing), explorer: explorerTx(out.tx), challengeWindowSeconds: deployment().challengePeriodSeconds }, null, 2));
  } else if (cmd === "challenge" && args.length === 5) {
    const itemId = itemIdOf(canonical(args[0], args[1], args[2]));
    const out = await challenge(key(), itemId, JSON.stringify({ file: args[3], quote: args[4] }));
    console.log(JSON.stringify({ ...out, itemId, explorer: explorerTx(out.tx) }, null, 2));
  } else if (cmd === "relay" && args.length === 1) {
    console.log(JSON.stringify(await relay(args[0] as Hex, `relay-${args[0].slice(2, 10)}`), null, 2));
  } else usage();
} catch (e) {
  console.error(`error: ${(e as Error).message.split("\n")[0]}`);
  process.exit(2);
}
