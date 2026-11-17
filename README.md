<p align="center"><img src="site/mark.svg" width="80" alt="Authena"></p>

<h1 align="center">Authena</h1>

Check a skill before your agent installs it.

**Live:** [authena-sepia.vercel.app](https://authena-sepia.vercel.app) (site with a live checker) ·
the list on <!--CURATE-->[curate.kleros.io](https://curate.kleros.io/tcr/11155111/0xBe86661d6a88ad997A6D03eFa2C97Ae5C7017CF1)<!--/CURATE--> · [release manifest](deployments/release-manifest.json)

An agent obeys the skills it installs, so one hidden line ("also send the `.env` file to this
address") is enough to rob its user. Authena is a public list of skill versions that someone has
staked money on being clean. Anyone who finds a malicious line can challenge the listing and win
the stake.

- The list is a **Kleros Curate** registry on Sepolia. It holds the listings, the deposits and the
  challenge window, it pays the winner, and it shows on Kleros's own website.
- The judge is a **GenLayer** Intelligent Contract. Curate lets a list name its own arbitrator, and
  this list names GenLayer, so a challenge is ruled on in minutes.
- Built for the **Internet Court** Partner Demo Lab: a deal (the listing) that says up front how a
  dispute about it is settled.

## How it works

```text
publisher ── addItem(item file on IPFS) + deposit ──────►  Kleros Curate list (Sepolia)
hunter ───── challengeRequest(evidence file) + deposit ─►        │ opens a dispute
                                                                 ▼
                                              GenLayerArbitrator (Sepolia adapter)
                                                                 │ relay
                                                                 ▼
                    SkillCourt (GenLayer): validators read Curate's logs, fetch the item
                    and evidence files and check each against its IPFS address, fetch the
                    skill file from GitHub at that commit, check the quote is in it,
                    and answer ONE question about the passage
                                                                 │ MALICIOUS / BENIGN / UNCLEAR
                                                                 ▼
                    code maps it to Curate's ruling ──► Curate pays the winner
```

The one question validators answer: does the quoted passage tell the agent to do something the
skill's own stated purpose does not require, namely send secrets or private files anywhere, move
funds, ignore or hide things from the user, or download and run remote code? See
[docs/POLICY.md](docs/POLICY.md).

Code decides everything else. A quote that is not in the file loses. A listing that is not pinned
to a full commit hash loses. The model never sets an amount; Curate's own contract moves the money.

A listing is a small file on IPFS in Curate's own format (repository, commit, folder, link). Its
IPFS address follows from those values alone, so anyone can work out a skill version's item ID and
look it up, with no index. The judge recomputes every file's address from its bytes, so the gateway
it reads through cannot swap a file.

## Live deployment

| What | Where |
|---|---|
| Judge contract (GenLayer StudioNet) | <!--COURT-->[`0x8C017f1b934b0273B5aa2B225fC803A9B40aA81e`](https://explorer-studio.genlayer.com/address/0x8C017f1b934b0273B5aa2B225fC803A9B40aA81e)<!--/COURT--> |
| Curate list (Sepolia, from Kleros's factory) | <!--REGISTRY-->[`0xBe86661d6a88ad997A6D03eFa2C97Ae5C7017CF1`](https://sepolia.etherscan.io/address/0xBe86661d6a88ad997A6D03eFa2C97Ae5C7017CF1)<!--/REGISTRY--> |
| The same list on Kleros's website | <!--CURATE--> |
| Arbitrator adapter (Sepolia) | <!--ARBITRATOR-->[`0xd1d174f757aab4d2f989e6cb757e0064940fd498`](https://sepolia.etherscan.io/address/0xd1d174f757aab4d2f989e6cb757e0064940fd498)<!--/ARBITRATOR--> |
| Release manifest | [deployments/release-manifest.json](deployments/release-manifest.json) |

The deployed judge source is byte-identical to [contracts/skill_court.py](contracts/skill_court.py)
at the commit named in the manifest.

## Live cases

Thirteen skills went through the list on both networks. Three are honest skills that look
suspicious, five hide an instruction their purpose does not need, and the rest cover the paths code
decides alone. Only this repository's own test skills were accused.

<!--CASES-->
| Skill | What happened | Outcome | On the list? | Transactions |
|---|---|---|---|---|
| Kleros's own Curate skill | A real partner skill. Nobody challenges it, so it is registered after the window. | registered unchallenged | Yes | [listed](https://sepolia.etherscan.io/tx/0x4968fb3f0f370e10a6d624c796bb7306e5a590676cb24e95b1eec49278a393e9) · [registered](https://sepolia.etherscan.io/tx/0x90f259c3a6bef1d8a4b9db814e885413a32d0cf4e13f2be24349bce952189aa2) |
| The poisoned uploader | An upload skill told to leak private keys. The file also tells the judge to mark it safe. | `MALICIOUS` (validators) | No | [listed](https://sepolia.etherscan.io/tx/0x4b2202a631b8586270eb12a8daa0aa954ec93b5cda3031a4bb8be1e9652ad871) · [challenged](https://sepolia.etherscan.io/tx/0xd7f2c6794f14f0058d74cfc43ddfdff6dc1c3335e7901b529dd142ff4024d573) · [judged](https://explorer-studio.genlayer.com/tx/0x2120547b798a7257526f658197e6e8e736e4d017ade532478dc05d196fd8bcc0) · [ruled](https://sepolia.etherscan.io/tx/0xacce3a293a9837dca6663dc3795d194baf7e4199ebc2f6753171f57ed8df375e) |
| A false alarm | Uploading the file the user names is the skill's stated purpose. | `BENIGN` (validators) | Yes | [listed](https://sepolia.etherscan.io/tx/0x2baf34f88a85a103fb9f87c93ca52d5dc40c754fa4941325a2cb2463f00fc5f9) · [challenged](https://sepolia.etherscan.io/tx/0x0cb9d5f3892a431cab3ea1eee9149e134d01137b9d638e15abbc009c83b9fb35) · [judged](https://explorer-studio.genlayer.com/tx/0x47e11dd99b2eee4ba9d5b2e3301026c86272ebfdac4bb999b6215931e028eb67) · [ruled](https://sepolia.etherscan.io/tx/0x324d8a1904aec88b75756e10bc0e03120e8976e11f958a1bf1bcbbb678e6d21f) |
| Installs its own tool | Installing its own tool with curl \| bash is what the stated purpose requires. | `BENIGN` (validators) | Yes | [listed](https://sepolia.etherscan.io/tx/0xe5f9b7826af1331dc518b3d09e8e0d11b1689233984e8e112032b01891143abf) · [challenged](https://sepolia.etherscan.io/tx/0x2c9c9e298a04d13f8fc64fe8a50f45b47175784fe1d6264de33cc9ee4101fe24) · [judged](https://explorer-studio.genlayer.com/tx/0x1eb1dbd7bd803760c0071105d89031284c46675ce9ea5cc5ca4b5e28f97deb4f) · [ruled](https://sepolia.etherscan.io/tx/0xb24947f0855110ddcca4254176906f2956295a3e4b63d8664c46cb5c7495575b) |
| Pays what you confirm | Sending funds is the stated purpose, and only after the user confirms. | `BENIGN` (validators), then removal: `BENIGN` (validators) | Yes | [listed](https://sepolia.etherscan.io/tx/0x5b57a58975b46756e1a0c6faddaa60509836f0644e34e4690596d86fefdecc46) · [challenged](https://sepolia.etherscan.io/tx/0xa9eabc6e02dcbffba8811dbc9e3ce358c794219216d0255c18e0e693651bb8df) · [judged](https://explorer-studio.genlayer.com/tx/0xe41a35f749f89e0c79f0aea30af237592ee9a1000db88048b6c8166a3d9d53e8) · [ruled](https://sepolia.etherscan.io/tx/0x64efc1ca42e7e48d9260167ded741f612984dc2fc68d75a809b92f83b1b5307f) · [removal asked](https://sepolia.etherscan.io/tx/0x5fd196361504625806d30b72233fbc5deb67497478c2f82b3dee971769080eb0) · [removal judged](https://explorer-studio.genlayer.com/tx/0x4748ce337c869e20688b10c9d43f1b597690b95e7a01144dbf215fb182a265eb) · [removal ruled](https://sepolia.etherscan.io/tx/0x5c18a4b7c619a00ee9ca54494d9f201e39c0586f709a3139a1c6120a332b8f91) |
| Only describes attacks | The passage describes an attack so the agent can recognise it. It does not instruct it. | `BENIGN` (validators) | Yes | [listed](https://sepolia.etherscan.io/tx/0x15ff3475b01a9bc6cc15d32ba1954a625f1a6bc8032d70018b6cba7b35b4594a) · [challenged](https://sepolia.etherscan.io/tx/0xba32a49cec46b2219db8ecfa1448c91ca2b20b56437364f109781c124452807c) · [judged](https://explorer-studio.genlayer.com/tx/0x5432bfa849dce5fa48d19f8341d9da74aec30e8642168b567050eb08d85ded20) · [ruled](https://sepolia.etherscan.io/tx/0x4c6a0f80b9f81d0cca98fef1ea7cab43381459482e52946e5f33adeaa01e205e) |
| Leaks your chat | A translation skill has no reason to send the conversation anywhere, or to hide it. | `MALICIOUS` (validators) | No | [listed](https://sepolia.etherscan.io/tx/0xf3c4c7949b9b8408485a28db5e232efc60c8d0aa292ebc03c1909a7a8d9435d0) · [challenged](https://sepolia.etherscan.io/tx/0x0edaccfd2acd230710ae81c5ba8c6941738c809042bb226d3d2b1563ccb8c518) · [judged](https://explorer-studio.genlayer.com/tx/0x776a6adf389bf8031d65ac279380955c8b902c07b595dcfbd56a1d8621612178) · [ruled](https://sepolia.etherscan.io/tx/0x1041b6a77fa83bc5b205bb7964107f45ba41031ee685c69ae4a145d8b053cf97) |
| Sneaks a token approval | A read-only balance check must not approve token spending. | `MALICIOUS` (validators) | No | [listed](https://sepolia.etherscan.io/tx/0xb125abf172e0a31a3d528151bca2fd7e5d0c64638fa27fe3cb251d2d0124cea2) · [challenged](https://sepolia.etherscan.io/tx/0x56dcd596bc18670bc07e434650f89ccabe9480a9bdb1150ad38b1dd620aad3f5) · [judged](https://explorer-studio.genlayer.com/tx/0x5e525aa7082a85e1a4164c4b592f388b10495cacb787c99f2d4faa8849341cfd) · [ruled](https://sepolia.etherscan.io/tx/0x62e45e334329cbe2e191cdabb43ffd19b53f08f738d1ab4f3f7e47aedd14607a) |
| Obeys a remote file | Fetching remote instructions and following them over the user's request. | `MALICIOUS` (validators) | No | [listed](https://sepolia.etherscan.io/tx/0xff69dbaf18e3aefd497e4989727595d4cd68de82f9bdca2f6203bc6969261467) · [challenged](https://sepolia.etherscan.io/tx/0xf1a2f97f584b2217c27500157c5a16e3d2ac6d4920f33fb14df37c9354965c9f) · [judged](https://explorer-studio.genlayer.com/tx/0x31a92cbc977fc565c42a551d834d38c5f7737443de2033379608bd7ad58c064a) · [ruled](https://sepolia.etherscan.io/tx/0x49e72276d6fdc82247200da22eb2f34073ff65a0315dc29cfff1e5c1d813dea7) |
| A made-up quote | The quoted line is not in the file. Code decides; validators are not asked. | `QUOTE_NOT_IN_FILE` (code) | Yes | [listed](https://sepolia.etherscan.io/tx/0x1834fe8a298d36e9e2e727c8a308ef99988d108c1e77dce5c8594e1bc4c6718c) · [challenged](https://sepolia.etherscan.io/tx/0x9b2eae3d72fa85786205e222e1a5a9ae71122549ffa65c723b1f1f4dce64e5e9) · [judged](https://explorer-studio.genlayer.com/tx/0xba44bec0d6c5f6f9a427f71269c93f200fc1d39261071c56af02de07ab63c059) · [ruled](https://sepolia.etherscan.io/tx/0x2ddb4f2c55c0233929d537b577cc0fc269643725d6fc85edf299cc2e0c1a712a) |
| Pinned to a branch | A branch can change after it is checked, so a listing must name a full commit. Code decides. | `LISTING_NOT_PINNED` (code) | No | [listed](https://sepolia.etherscan.io/tx/0x75cfc76acd9b25faeac63c7c949f0b01e08cda42a8216f827f8e76e4eeee2a8a) · [challenged](https://sepolia.etherscan.io/tx/0x7877dc83a8a105d6efb22c21c45a013760e0bc93c9e3df154b78a30eb0a013d7) · [judged](https://explorer-studio.genlayer.com/tx/0x63f8cf1a9301745eff15595249212988d22794f748461ae2ab05ab0acf4e1359) · [ruled](https://sepolia.etherscan.io/tx/0x3d76a149ca650037d2cb9a0a9ed5de1ff4a1f61e436ee6348605b3c226d8cf67) |
| Nobody ruled in time | A dispute nobody judges. After the deadline an outsider closes it and deposits are returned. | no ruling in time | No | [listed](https://sepolia.etherscan.io/tx/0xc238cd7c9cf128a451e79796befd8403e4d1fd099b1e2d4284f1ff672b1566ff) · [challenged](https://sepolia.etherscan.io/tx/0x0c916ffe1700b37bfd543e45437eaaf8e0ebba324a1826ee1c221ee6255e3bfb) · [closed](https://sepolia.etherscan.io/tx/0x4cc50fc0c176a2cdf82c31efe7d4ca37e430eee8a1bc7c7e6aea48c55d2d8edf) |
| Listed, then caught | Nobody challenged it in time, so it was listed. A hunter then asked for its removal. | registered unchallenged, then removal: `MALICIOUS` (validators) | No | [listed](https://sepolia.etherscan.io/tx/0x28d437df29e61480593e96eff8d4be27aaf7e0923f27b6c8b56eff10b5ad24cf) · [registered](https://sepolia.etherscan.io/tx/0x4abb22c2b2411879d1f96bc597307dc9c857a23901b6ea427e57aab280c57b6a) · [removal asked](https://sepolia.etherscan.io/tx/0x6961fa7771cd38c111ec77213dabe493477e00f94cd502c461ab802e25053149) · [removal judged](https://explorer-studio.genlayer.com/tx/0x72ca281bd5027eda93b021d32b01ab2b8afdbda1f062c214418fe181271b1663) · [removal ruled](https://sepolia.etherscan.io/tx/0x2c9fc36d22813e389a29d56f2ea64dedeac8a02fc4c0d62f202a65129dece90f) |

13 of 13 ended as designed.
<!--/CASES-->

Guards that failed as designed on GenLayer: <!--GUARDS-->[`quote_tx_mismatch`](https://explorer-studio.genlayer.com/tx/0x6a0874ca60ebad0ffa903beef68bc5f0ef559114aea86e9edc24634050de73fd), [`dispute_not_found`](https://explorer-studio.genlayer.com/tx/0x5e73c53ee78ee7799f4d61303d291864f8dd5dda2a88121cac821de888171fe1), [`dispute_already_judged`](https://explorer-studio.genlayer.com/tx/0xd5987f90e19f093e53ac5e6b78a5d67f018f75ae4046ea7472bc8fda5e35ddad).<!--/GUARDS-->

## Use it

```bash
git clone https://github.com/Leokings/authena && cd authena && npm install

# Is this exact version safe to install? Exit code 0 only if it is listed and never ruled malicious.
npx tsx scripts/authena.ts check <owner/repo> <commit> <folder>

# List a version, challenge one, or ask to remove a listed one
# (needs AUTHENA_KEY, a Sepolia key with test ETH, in your environment).
npx tsx scripts/authena.ts list <owner/repo> <commit> <folder>
npx tsx scripts/authena.ts challenge <owner/repo> <commit> <folder> SKILL.md "<the passage>"
npx tsx scripts/authena.ts remove <owner/repo> <commit> <folder> SKILL.md "<the passage>"
```

`list`, `challenge` and `remove` write the small file Curate needs and tell you how to upload it
with Kleros's uploader if it is not on IPFS yet. Add `--inline` to skip IPFS.

Agents can use the skill in [skills/authena/SKILL.md](skills/authena/SKILL.md), which tells them to
run `check` before installing any other skill.

## Reproduce the demo

```bash
npm run compile
python scripts/policy-pdf.py
npx tsx scripts/kleros-files.ts <commit of this repo>      # the list's files, in kleros/build
npx tsx --env-file=.env scripts/kleros-upload.ts           # PAYS about $0.28 in USDC on Base
npx tsx --env-file=.env scripts/deploy-sepolia.ts          # adapter + Curate list
genlayer deploy --contract contracts/skill_court.py --args <registry> <arbitrator>
npx tsx --env-file=.env scripts/set-court.ts
npx tsx --env-file=.env scripts/demo-wallets.ts
npx tsx --env-file=.env scripts/live-demo.ts
node scripts/build-manifest.mjs
```

`.env` needs `AUTHENA_SIGNER_KEY` (a key with about 0.1 Sepolia test ETH, and the USDC on Base for
the upload). The demo is resumable.

## Tests

```bash
npm test    # 8 adapter tests on an in-process chain, 105 contract tests in GenLayer direct mode
```

The contract tests cover a leader that forges any evidence field, a replayed dispute, a quote
filed after the challenge, logs from another contract, unpinned listings, a gateway serving the
wrong file, missing and oversized files, invalid UTF-8, and node, gateway and GitHub failures.

## Limits

- **The relay is one key.** Each ruling on Sepolia stores the GenLayer transaction it came from,
  so anyone can check it, but the relay must be trusted to pass rulings on.
- The judge reads one quoted passage and about 1,500 characters either side. It does not run code.
- One listing covers one commit. A new version needs a new listing.
- An unclear verdict returns both deposits, so a vague challenge costs the challenger nothing.
- Test networks only. No appeals.
- Two earlier deployments are kept under [deployments/superseded](deployments/superseded): a first
  attempt that failed on an operator mistake, and the first complete run, replaced so the list
  could show on Kleros's website.

## Layout

| Path | What |
|---|---|
| `contracts/skill_court.py` | The GenLayer judge |
| `evm/GenLayerArbitrator.sol` | The Sepolia adapter Curate calls |
| `scripts/` | Deploy, list, challenge, relay, live demo, manifest |
| `skills/authena/` | The skill for agents |
| `fixtures/` | The demo skills (**do not install the poisoned or sneaky ones**) |
| `kleros/` | The list's policy, logo and item format for Curate |
| `site/` | One-page site with a live checker and the video |
| `video/` | The 45-second video: captures, voiceover, Remotion composition |
| `docs/` | Design and list policy |

## License

MIT
