#!/usr/bin/env tsx
/**
 * Authena command line: check, list and challenge agent skills on the Authena Curate list.
 *
 *   npx tsx scripts/authena.ts check <owner/repo> <commit> <folder>
 *   npx tsx scripts/authena.ts verdict <dispute-id>
 *   npx tsx scripts/authena.ts list <owner/repo> <commit> <folder>                      (needs AUTHENA_KEY)
 *   npx tsx scripts/authena.ts challenge <owner/repo> <commit> <folder> <file> "<quote>" (needs AUTHENA_KEY)
 *   npx tsx scripts/authena.ts remove <owner/repo> <commit> <folder> <file> "<quote>"    (needs AUTHENA_KEY)
 *   npx tsx scripts/authena.ts relay <sepolia-challenge-tx>                              (relayer only)
 *
 * `check` exits 0 only when that exact version is registered and was never ruled malicious, so an
 * agent can gate an install on it.
 *
 * A listing and a challenge are small files on IPFS in Kleros Curate's format, so they also show
 * on Kleros's website. `list`, `challenge` and `remove` write the file, and stop to tell you how to
 * upload it if it is not on IPFS yet. Add --inline to skip IPFS and write the details straight
 * into the transaction (the judge accepts it, but Kleros's website cannot display it).
 *
 * AUTHENA_KEY is a Sepolia private key with a little test ETH. Keep it in a .env file, never in chat.
 */
import { writeFileSync } from "node:fs";
import type { Hex } from "viem";
import { deployment, explorerTx, wallet } from "./lib";
import { challenge, itemIdOf, list, listingOf, relay, requestRemoval, skillVerdicts, status, verdict } from "./curate-lib";
import { evidenceFile, ipfsAddress, itemFor, onIpfs, stable } from "./kleros-lib";

const raw = process.argv.slice(2);
const inline = raw.includes("--inline");
const [cmd, ...args] = raw.filter((a) => a !== "--inline");

const key = () => {
  const k = process.env.AUTHENA_KEY;
  if (!k) throw new Error("Set AUTHENA_KEY in your environment (a Sepolia key with test ETH). Never paste it into chat.");
  return wallet((k.startsWith("0x") ? k : `0x${k}`) as Hex) as any;
};
const clean = (folder = "") => folder.replace(/^\/+|\/+$/g, "");
const pinned = (commit: string) => {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("commit must be the full 40-character hash, so the content cannot change");
};
/** What goes on-chain for a listing: the IPFS address of its item file, or the inline JSON. */
const itemString = (repo: string, commit: string, folder: string) => (inline ? listingOf(repo, commit, folder) : ipfsAddress(stable(itemFor(repo, commit, folder))));

/** Makes sure a file is on IPFS before its address is written on-chain. */
async function uploaded(content: string, saveAs: string): Promise<string | null> {
  if (await onIpfs(content)) return ipfsAddress(content);
  writeFileSync(saveAs, content);
  console.error(`${saveAs} is not on IPFS yet. Upload it with Kleros's uploader (one cent in USDC on Base), then run this again:`);
  console.error(`  https://github.com/internet-court/internet-court-skill/tree/main/vendored/kleros/kleros-ipfs-upload`);
  console.error(`It must come back as ${ipfsAddress(content)}. Or add --inline to skip IPFS.`);
  process.exitCode = 3;
  return null;
}
const usage = () => {
  // Exit codes are set, not forced: calling process.exit() while sockets are still closing crashes
  // Node on Windows (exit 127), which would break "exit 0 only if listed".
  console.error("usage: authena check|list|challenge|remove|verdict|relay … (see the header of scripts/authena.ts)");
  process.exitCode = 2;
};

try {
  if (cmd === "check" && args.length >= 2) {
    const [repo, commit] = args;
    const folder = clean(args[2]);
    pinned(commit);
    // The item's ID follows from the skill version alone, so no index is needed to find it.
    const address = ipfsAddress(stable(itemFor(repo, commit, folder)));
    const candidates = [itemIdOf(address), itemIdOf(listingOf(repo, commit, folder))];
    const states = await Promise.all(candidates.map((id) => status(id)));
    const at = states.findIndex((s) => s !== "absent");
    const s = at < 0 ? "absent" : states[at];
    const judged = await skillVerdicts(repo, commit, folder);
    const safe = s === "registered" && !judged.malicious;
    console.log(
      JSON.stringify(
        { skill: { repo, commit, folder }, status: judged.malicious ? "ruled malicious" : s, onCurate: s, safeToInstall: safe, itemId: candidates[Math.max(at, 0)], itemAddress: address, verdicts: judged.verdicts, registry: deployment().registry },
        null,
        2,
      ),
    );
    process.exitCode = safe ? 0 : 1;
  } else if (cmd === "verdict" && args.length === 1) {
    if (!/^\d+$/.test(args[0])) throw new Error("the dispute ID must be a whole number");
    console.log(JSON.stringify(await verdict(Number(args[0])), null, 2));
  } else if (cmd === "list" && args.length >= 2) {
    const [repo, commit] = args;
    const folder = clean(args[2]);
    pinned(commit);
    const item = inline ? listingOf(repo, commit, folder) : await uploaded(stable(itemFor(repo, commit, folder)), "authena-item.json");
    if (item) {
      const out = await list(key(), item);
      console.log(JSON.stringify({ ...out, listed: item, explorer: explorerTx(out.tx), challengeWindowSeconds: deployment().challengePeriodSeconds }, null, 2));
    }
  } else if ((cmd === "challenge" || cmd === "remove") && args.length === 5) {
    const [repo, commit, , file, quote] = args;
    const folder = clean(args[2]);
    pinned(commit);
    const itemId = itemIdOf(itemString(repo, commit, folder));
    const accusation = inline ? JSON.stringify({ file, quote }) : await uploaded(stable(evidenceFile(quote, file)), "authena-evidence.json");
    if (accusation) {
      // `remove` asks to take a listed skill off the list; it succeeds unless someone disputes it.
      const out = cmd === "challenge" ? await challenge(key(), itemId, accusation) : await requestRemoval(key(), itemId, accusation);
      console.log(JSON.stringify({ ...out, itemId, accusation, explorer: explorerTx(out.tx) }, null, 2));
    }
  } else if (cmd === "relay" && args.length === 1) {
    console.log(JSON.stringify(await relay(args[0] as Hex, `relay-${args[0].slice(2, 10)}`), null, 2));
  } else usage();
} catch (e) {
  console.error(`error: ${(e as Error).message.split("\n")[0]}`);
  process.exitCode = 2;
}
