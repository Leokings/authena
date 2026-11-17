// The files Kleros Curate's website reads: the list description (MetaEvidence), one item file per
// listing and one evidence file per challenge, all in Curate's own format.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export type Case = {
  id: string;
  title: string;
  repo: string;
  commit: string; // a commit hash, "FIX" (the fixtures commit) or a branch name for the unpinned case
  folder: string;
  flow: "unchallenged" | "challenge" | "timeout" | "caught-later";
  then?: "false-removal";
  quote?: string;
  why: string;
  expect: string | null;
};

export const LIST_TITLE = "Authena: Safe Agent Skills";
export const LIST_DESCRIPTION = "AI-agent skill versions that someone has staked a deposit on being safe to install. Challenges are judged by GenLayer validators.";
// The standard evidence display Curate's own list wizard uses on Sepolia.
export const EVIDENCE_DISPLAY = "/ipfs/QmQjJio59WkrQDzPC5kSP3EiGaqrWxjGfkvhmD2mWwm41M/index.html";

// One definition, shared with the website, so both build byte-identical item files.
export const COLUMNS: { label: string; description: string; type: string; isIdentifier: boolean }[] = JSON.parse(readFileSync("kleros/columns.json", "utf8"));

export const cases = (): Case[] => JSON.parse(readFileSync("fixtures/demo.json", "utf8"));
export const commitOf = (c: Case, fix: string) => (c.commit === "FIX" ? fix : c.commit);
export const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
/** One stable serialisation, so the same content always gives the same file and the same CID. */
export const stable = (doc: unknown) => JSON.stringify(doc, null, 2) + "\n";

/** The item file for one skill version. Everyone who builds it this way gets the same bytes. */
export function itemFor(repo: string, commit: string, folder: string) {
  return {
    columns: COLUMNS,
    values: { Repository: repo, Commit: commit, Folder: folder, Skill: `https://github.com/${repo}/tree/${commit}${folder ? `/${folder}` : ""}` },
  };
}

export const itemFile = (c: Case, fix: string) => itemFor(c.repo, commitOf(c, fix), c.folder);

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const varint = (n: number) => {
  const out: number[] = [];
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n);
  return Buffer.from(out);
};

/**
 * The IPFS address (CID version 0) of a small file, as `/ipfs/Qm…`: the hash of its one-block
 * UnixFS node. It is what Kleros's uploader returns for a file under 256 KB, so an item's address,
 * and from it the item's ID on Curate, can be worked out from the skill version alone.
 */
export function ipfsAddress(data: string | Buffer): string {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
  const unixfs = Buffer.concat([Buffer.from([8, 2, 18]), varint(bytes.length), bytes, Buffer.from([24]), varint(bytes.length)]);
  const digest = Buffer.concat([Buffer.from([18, 32]), createHash("sha256").update(Buffer.concat([Buffer.from([10]), varint(unixfs.length), unixfs])).digest()]);
  let n = BigInt("0x" + digest.toString("hex"));
  let text = "";
  while (n > 0n) {
    text = BASE58[Number(n % 58n)] + text;
    n /= 58n;
  }
  return "/ipfs/" + text;
}

/** Whether Kleros's gateway serves exactly these bytes at their address. */
export async function onIpfs(data: string): Promise<boolean> {
  try {
    const res = await fetch("https://cdn.kleros.link" + ipfsAddress(data), { signal: AbortSignal.timeout(25_000) });
    return res.ok && Buffer.from(await res.arrayBuffer()).equals(Buffer.from(data, "utf8"));
  } catch {
    return false;
  }
}

export function evidenceFile(quote: string, file = "SKILL.md") {
  return { title: `Unsafe passage in ${file}`, description: `Quoted passage: "${quote}"`, file, quote };
}

export function metaEvidence(kind: "registration" | "clearing", policy: string, logo: string) {
  const add = kind === "registration";
  return {
    title: add ? `Add a skill to ${LIST_TITLE}` : `Remove a skill from ${LIST_TITLE}`,
    description: add ? `Someone requested to add a skill to ${LIST_TITLE}.` : `Someone requested to remove a skill from ${LIST_TITLE}.`,
    rulingOptions: {
      titles: add ? ["Yes, Add It", "No, Don't Add It"] : ["Yes, Remove It", "No, Don't Remove It"],
      descriptions: add
        ? ["Select this if you think the skill complies with the required criteria and should be added.", "Select this if you think the skill does not comply with the required criteria and should not be added."]
        : ["Select this if you think the skill fails to comply with the required criteria and should be removed.", "Select this if you think the skill complies with the required criteria and should not be removed."],
    },
    category: "Curated Lists",
    question: add ? "Does the skill comply with the required criteria?" : "Does the skill fail to comply with the required criteria?",
    fileURI: policy,
    evidenceDisplayInterfaceURI: EVIDENCE_DISPLAY,
    metadata: {
      tcrTitle: LIST_TITLE,
      tcrDescription: LIST_DESCRIPTION,
      columns: COLUMNS,
      itemName: "skill",
      itemNamePlural: "skills",
      logoURI: logo,
      requireRemovalEvidence: true,
      isTCRofTCRs: false,
      relTcrDisabled: true,
    },
  };
}
