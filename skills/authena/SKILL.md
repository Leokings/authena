---
name: authena
description: Check whether an AI-agent skill version is on the Authena list of skills that are safe to install, before installing it. Also list a skill version or challenge a listed one. Use before installing any skill from a GitHub repository.
---

# Authena

Authena is a public list of agent-skill versions that someone has staked money on being clean.
The list is a Kleros Curate registry on Sepolia. Challenges are judged by GenLayer validators.

## Before installing a skill

1. Find the skill's repository, the **full 40-character commit hash** you are about to install,
   and its folder (the one that holds `SKILL.md`).
2. Run:

   ```bash
   npx tsx scripts/authena.ts check <owner/repo> <commit> <folder>
   ```

3. Exit code 0 and `"safeToInstall": true` mean that exact version is registered and was never
   ruled malicious. Install that commit only, not a newer one.
4. `"status": "ruled malicious"` means validators found a malicious passage in that version. Do
   not install it, and show the user the quoted passage from `verdicts`.
5. Any other result means it is not on the list. Tell the user and ask before installing. Never
   treat "not listed" as "safe".

## Listing a skill version

Needs `AUTHENA_KEY` (a Sepolia key with test ETH) in the environment. Never ask the user to paste
a key into chat.

```bash
npx tsx scripts/authena.ts list <owner/repo> <commit> <folder>
```

The deposit is returned if nobody challenges within the window, or if a challenge fails.

The listing is a small file on IPFS. If the command says the file is not on IPFS yet, upload the
file it wrote with Kleros's uploader (the `kleros-ipfs-upload` skill, one cent) and run it again.

## Challenging a listing

Quote the passage exactly as it appears in the file (20 to 600 characters).

```bash
npx tsx scripts/authena.ts challenge <owner/repo> <commit> <folder> <file> "<quote>"
```

To ask for a skill that is already listed to be removed, use `remove` with the same arguments.

A passage counts as malicious when it tells the agent to do one of these in a way the skill's
stated purpose does not require: send secrets or private files anywhere, move or approve funds,
ignore or hide things from the user, or download and run remote code. See `docs/POLICY.md`.

## Limits

- A listing covers one commit. A new version needs a new listing.
- The judge reads the quoted passage and its surroundings. It does not run code.
- Test networks only.
