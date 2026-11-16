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

export const COLUMNS = [
  { label: "Repository", description: "GitHub repository as owner/name.", type: "text", isIdentifier: true },
  { label: "Commit", description: "The full 40-character commit hash of the listed version.", type: "text", isIdentifier: true },
  { label: "Folder", description: "Folder in the repository that holds SKILL.md.", type: "text", isIdentifier: true },
  { label: "Skill", description: "Link to the skill at that commit.", type: "link", isIdentifier: false },
];

export const cases = (): Case[] => JSON.parse(readFileSync("fixtures/demo.json", "utf8"));
export const commitOf = (c: Case, fix: string) => (c.commit === "FIX" ? fix : c.commit);
export const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
/** One stable serialisation, so the same content always gives the same file and the same CID. */
export const stable = (doc: unknown) => JSON.stringify(doc, null, 2) + "\n";

export function itemFile(c: Case, fix: string) {
  const commit = commitOf(c, fix);
  return {
    columns: COLUMNS,
    values: { Repository: c.repo, Commit: commit, Folder: c.folder, Skill: `https://github.com/${c.repo}/tree/${commit}/${c.folder}` },
  };
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
