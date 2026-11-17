# Portal submission (draft — not submitted)

Mission: **Internet Court: Partner Demo Lab** · Type: Projects · Partner: **Kleros**

| Field | Value |
|---|---|
| Project name | Authena |
| Primary tag | AI & Agents |
| Website | https://authena-sepia.vercel.app |
| GitHub | https://github.com/Leokings/authena |
| Contract link | https://explorer-studio.genlayer.com/address/0x8C017f1b934b0273B5aa2B225fC803A9B40aA81e |
| Demo URL (YouTube or X) | _the post with the video_ |

## One-liner (170/180)

A Kleros Curate list of AI-agent skills that are safe to install. Anyone can challenge one by quoting a bad line; GenLayer validators judge it and Kleros pays the winner.

## Description (878/1000)

An agent obeys every skill it installs, so one hidden line can make it leak keys or move funds. Authena is a Kleros Curate list of skill versions, each pinned to a commit, that a publisher has staked a deposit on being clean. Anyone can challenge by quoting the bad line. The list names a GenLayer contract as its arbitrator: validators read the listing and the challenge from Sepolia, check each IPFS file against its address, fetch the skill from GitHub, confirm the quote is in it, and answer one question: does it tell the agent to do something its stated purpose does not need? Code maps the answer to Curate's ruling and Kleros pays the winner. Live: 13 skills on one list. Hidden leaks, a token approval and a remote loader were busted; honest look-alikes stayed listed. The list shows on Kleros's website. Limits: test networks; one relay key carries rulings to Sepolia.

## How-to

1. **Check a skill.** Open https://authena-sepia.vercel.app and paste github.com/Leokings/authena/tree/61f610cdd5f16f830715a83497f3b4c115792c88/fixtures/skills/poisoned-do-not-install, then press Check.
2. **See it on Kleros.** Open https://curate.kleros.io/tcr/11155111/0xBe86661d6a88ad997A6D03eFa2C97Ae5C7017CF1. Turn the NSFW filter off to see every item. Open the rejected poisoned-do-not-install item: the ruling, the quoted line and the dates.
3. **See the judgment.** Open https://explorer-studio.genlayer.com/tx/0x2120547b798a7257526f658197e6e8e736e4d017ade532478dc05d196fd8bcc0. Execution result SUCCESS, return value "MALICIOUS".
4. **Check from the command line.** Clone https://github.com/Leokings/authena, run npm install, then: npx tsx scripts/authena.ts check Leokings/authena 61f610cdd5f16f830715a83497f3b4c115792c88 fixtures/skills/file-uploader (exit 0), and the same with fixtures/skills/pdf-summarizer (exit 1).
5. **Reproduce.** Run npm test (105 contract tests, 8 adapter tests). The README lists the deploy and live-demo commands.

## Expected verification outcome (398/500)

The site stamps the poisoned skill BUSTED and quotes the planted line. On Kleros the item is Rejected with "The arbitrator ruled in favor of the challenger". The GenLayer transaction is FINALIZED and returns MALICIOUS. check exits 0 for file-uploader (registered, BENIGN) and 1 for pdf-summarizer (caught after listing). The manifest shows 13/13 cases as designed and 16/16 GenLayer steps as proof.

## Evidence

- Repository: https://github.com/Leokings/authena
- Judge contract at the deployed commit: https://github.com/Leokings/authena/blob/a9cb24d3c35dac11444d4016e4ba4f51bc7fe603/contracts/skill_court.py
- Sepolia arbitrator adapter: https://github.com/Leokings/authena/blob/main/evm/GenLayerArbitrator.sol
- Release manifest: every transaction, vote and read-back: https://github.com/Leokings/authena/blob/main/deployments/release-manifest.json
- The list on Kleros Curate: https://curate.kleros.io/tcr/11155111/0xBe86661d6a88ad997A6D03eFa2C97Ae5C7017CF1
- Judge contract on the GenLayer explorer: https://explorer-studio.genlayer.com/address/0x8C017f1b934b0273B5aa2B225fC803A9B40aA81e
- Judgment: poisoned uploader, MALICIOUS: https://explorer-studio.genlayer.com/tx/0x2120547b798a7257526f658197e6e8e736e4d017ade532478dc05d196fd8bcc0
- Judgment: false alarm, BENIGN: https://explorer-studio.genlayer.com/tx/0x47e11dd99b2eee4ba9d5b2e3301026c86272ebfdac4bb999b6215931e028eb67
- Judgment: sneaky token approval, MALICIOUS: https://explorer-studio.genlayer.com/tx/0x5e525aa7082a85e1a4164c4b592f388b10495cacb787c99f2d4faa8849341cfd
- Judgment: removal of a listed skill, MALICIOUS: https://explorer-studio.genlayer.com/tx/0x72ca281bd5027eda93b021d32b01ab2b8afdbda1f062c214418fe181271b1663
- Code decides: quote not in file: https://explorer-studio.genlayer.com/tx/0xba44bec0d6c5f6f9a427f71269c93f200fc1d39261071c56af02de07ab63c059
- Expected failure: quote_tx_mismatch: https://explorer-studio.genlayer.com/tx/0x6a0874ca60ebad0ffa903beef68bc5f0ef559114aea86e9edc24634050de73fd
- Expected failure: dispute_not_found: https://explorer-studio.genlayer.com/tx/0x5e73c53ee78ee7799f4d61303d291864f8dd5dda2a88121cac821de888171fe1
- Expected failure: dispute_already_judged: https://explorer-studio.genlayer.com/tx/0xd5987f90e19f093e53ac5e6b78a5d67f018f75ae4046ea7472bc8fda5e35ddad
- Ruling paid on Sepolia (poisoned uploader): https://sepolia.etherscan.io/tx/0xacce3a293a9837dca6663dc3795d194baf7e4199ebc2f6753171f57ed8df375e
- 45-second video: https://authena-sepia.vercel.app/video/authena.mp4
- Live site: https://authena-sepia.vercel.app
