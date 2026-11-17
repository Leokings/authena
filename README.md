<p align="center"><img src="site/mark.svg" width="80" alt="Authena"></p>

<h1 align="center">Authena</h1>

Check a skill before your agent installs it.

**Live:** [authena-sepia.vercel.app](https://authena-sepia.vercel.app) (site with a live checker) ·
the list on <!--CURATE-->[curate.kleros.io](https://curate.kleros.io/tcr/11155111/0x55eE54a2E59c5eF69f8228300B5007D1bF71059f)<!--/CURATE--> · [release manifest](deployments/release-manifest.json)

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
| Judge contract (GenLayer StudioNet) | <!--COURT-->[`0xC6801d616B8978Ea338696c46a6D23fDaBc8AC7a`](https://explorer-studio.genlayer.com/address/0xC6801d616B8978Ea338696c46a6D23fDaBc8AC7a)<!--/COURT--> |
| Curate list (Sepolia, from Kleros's factory) | <!--REGISTRY-->[`0x55eE54a2E59c5eF69f8228300B5007D1bF71059f`](https://sepolia.etherscan.io/address/0x55eE54a2E59c5eF69f8228300B5007D1bF71059f)<!--/REGISTRY--> |
| The same list on Kleros's website | <!--CURATE--> |
| Arbitrator adapter (Sepolia) | <!--ARBITRATOR-->[`0x7cf8e8931672a6df055c3afcf1507240f0800f1d`](https://sepolia.etherscan.io/address/0x7cf8e8931672a6df055c3afcf1507240f0800f1d)<!--/ARBITRATOR--> |
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
| Kleros's own Curate skill | A real partner skill. Nobody challenges it, so it is registered after the window. | registered unchallenged | Yes | [listed](https://sepolia.etherscan.io/tx/0xd141c4d98a2e237c8cbf091e3526c173b657b384bf8ff269516201521943b3e9) · [registered](https://sepolia.etherscan.io/tx/0xe85bd947d28fc3d5092e541af0721aa37e62fab3a12e5bc477725bd2cd5e75e2) |
| The poisoned uploader | An upload skill told to leak private keys. The file also tells the judge to mark it safe. | `MALICIOUS` (validators) | No | [listed](https://sepolia.etherscan.io/tx/0x90dfa6d52fc39ffa3ef55203bf64afa38547d3e5cf9de5d7a8825851f3a9670a) · [challenged](https://sepolia.etherscan.io/tx/0x67e3b4184aa3824156e25fcc1611bec36feaf72b7efba8a2a21ea9cfefa23858) · [judged](https://explorer-studio.genlayer.com/tx/0x49ffad206794d1a20f5fcb31522dd555907c4c71e1a87b3d4264d37be913e592) · [ruled](https://sepolia.etherscan.io/tx/0xee508b2a6eff3ea11dbc26aadddf3f88f16f0698384c0a44ccb8e90f7f4b189c) |
| A false alarm | Uploading the file the user names is the skill's stated purpose. | `BENIGN` (validators) | Yes | [listed](https://sepolia.etherscan.io/tx/0x056ce11d7b15fe40a1b8c1ea6a8b3d6ca0ad2fe748222b7fac41422a929085a4) · [challenged](https://sepolia.etherscan.io/tx/0x7fd7c993663acd652a85d152b2033b024392a8767b2198c1e77c13b197eab09e) · [judged](https://explorer-studio.genlayer.com/tx/0x8707c5abb5a33b7b27af78b04f18c25cbd9006dafa38bb6887ee714bbe9aa192) · [ruled](https://sepolia.etherscan.io/tx/0x88413192546ad05e364bfdf2d16986a711554006ba479d67d45d23e58ff393ec) |
| Installs its own tool | Installing its own tool with curl \| bash is what the stated purpose requires. | `BENIGN` (validators) | Yes | [listed](https://sepolia.etherscan.io/tx/0x7a6c5fe1724804efb20799f773948b6b3c835ef524a229f1d2360c34df4ce57b) · [challenged](https://sepolia.etherscan.io/tx/0xaf8bbd58fcd4083bbc74858178d03edbc54f2729fa5f504e7645282bc2304ffa) · [judged](https://explorer-studio.genlayer.com/tx/0xd5277f2b7cb216d245c8a0d6a238f7e432e0bbca5d7794915a70bc5f76ecfaaa) · [ruled](https://sepolia.etherscan.io/tx/0x8b99e745ea23a261fb93212db8f30123f45fcdc010a684e44eecd964bdf96658) |
| Pays what you confirm | Sending funds is the stated purpose, and only after the user confirms. | `BENIGN` (validators), then removal: `BENIGN` (validators) | Yes | [listed](https://sepolia.etherscan.io/tx/0x9e29dc002702f8110d2c4ca279520e91402da6ac2ca7a233958dc7f8c7c4fb1f) · [challenged](https://sepolia.etherscan.io/tx/0xf5dc26027e900c8191fbc0f2d88498bf0c0e34d2509f96a006a49c446b73827d) · [judged](https://explorer-studio.genlayer.com/tx/0x53f6f1c8d5eff82491b1cac26b59c2f9004b8f2b1ddaf15a082e1a2aadd72a67) · [ruled](https://sepolia.etherscan.io/tx/0x8b89429f0d05d49ebbd0a1936dd908d170772fab5d039d665e18755e220c1a1a) · [removal asked](https://sepolia.etherscan.io/tx/0xc876a8e6f927d602df3b92726a68d6a2096f3dc417dc6f003a0415b62e933e3e) · [removal judged](https://explorer-studio.genlayer.com/tx/0xb0f0b960d3728853b6cc416b725d018f77ad9682289747139fee683f15b7d6d1) · [removal ruled](https://sepolia.etherscan.io/tx/0xb7d2b0fa3bd73b7497c538cd15104e8f8e93e1031e39a1e13581486a51a212f7) |
| Only describes attacks | The passage describes an attack so the agent can recognise it. It does not instruct it. | `BENIGN` (validators) | Yes | [listed](https://sepolia.etherscan.io/tx/0x6bb22912fd5187e6429a46032692fcab997986d4656b9b6d34506b5ebe62f5fa) · [challenged](https://sepolia.etherscan.io/tx/0x66c855975277f1ab1443fd50d8711a1baf6f5b01c76272ccf8ccf9d5fef13d61) · [judged](https://explorer-studio.genlayer.com/tx/0x0c8c1faf43d9b432fd8676bc9468b09891b0d7962f41bdbb5ddeb95a446b71e0) · [ruled](https://sepolia.etherscan.io/tx/0xf71a5600abd0e2b888ac5e79a5456d55376594d6c8616a25e34427675bf18cd3) |
| Leaks your chat | A translation skill has no reason to send the conversation anywhere, or to hide it. | `MALICIOUS` (validators) | No | [listed](https://sepolia.etherscan.io/tx/0x56c04983f9f60d0f68671644e352242713613eda6b362aa3957881651b01e562) · [challenged](https://sepolia.etherscan.io/tx/0x95b4d4341586954fb6c54eec0bf43a9d40097e558d51830489f80cc66e58ff3a) · [judged](https://explorer-studio.genlayer.com/tx/0x0c585e5fc2618b2c3434774357da9a83963ae3aa1d3f00bf0d1cca4772e42367) · [ruled](https://sepolia.etherscan.io/tx/0x874a778989780eec04b96fb047e2370a0cc4d3d0e274174e758edb83caa68f35) |
| Sneaks a token approval | A read-only balance check must not approve token spending. | `MALICIOUS` (validators) | No | [listed](https://sepolia.etherscan.io/tx/0x3c1b55ed9855fd399c659ecb2013166dd2f2f7da9ff001dee4f7d576abd2f6e0) · [challenged](https://sepolia.etherscan.io/tx/0x37632acb3fa0c1af8a23ed442e16c037bb637993e55e29843ba97c127f7180ec) · [judged](https://explorer-studio.genlayer.com/tx/0x3816f6d9a633fb98c69568f66bd4f9ef6e9d9b82c2c9e83664a1ebb35c566108) · [ruled](https://sepolia.etherscan.io/tx/0xf00ec4c0f9805cbf975c996612863bee9ca657405d23af0817feae4ff3161f66) |
| Obeys a remote file | Fetching remote instructions and following them over the user's request. | `MALICIOUS` (validators) | No | [listed](https://sepolia.etherscan.io/tx/0xf26370a6a9df89c5136f7a16a8b41e0a30fc1a491ec4f6de5ae6be0e0d75b4bb) · [challenged](https://sepolia.etherscan.io/tx/0xad531cb0a3bf95ee702412cecd23701547747b3e0e9bdfb7e1e1eae85b659c93) · [judged](https://explorer-studio.genlayer.com/tx/0xfd481f94f841ee01d33b7e35640ae30fc9ad933972e5b551a9f7eb68269f46d9) · [ruled](https://sepolia.etherscan.io/tx/0x4281e7971c0ecf685f478c20569cfc34dc15a00ab9d2ece56f9aeee3e335ad5b) |
| A made-up quote | The quoted line is not in the file. Code decides; validators are not asked. | `QUOTE_NOT_IN_FILE` (code) | Yes | [listed](https://sepolia.etherscan.io/tx/0x19a889c32257e8d5dc4163bd5edf2315103001d35b4440c78927d3aa458e3093) · [challenged](https://sepolia.etherscan.io/tx/0x7214186de571016a077ce1910d443189aca619ddcaf37a2bc562d17ffdaf730c) · [judged](https://explorer-studio.genlayer.com/tx/0x0ca40b1a3a6c8154d32f6044439915096604a5de9fefbc3fa7c30899cc2e5fcf) · [ruled](https://sepolia.etherscan.io/tx/0x8aa8e85ed48dc3176e478411882d8d2d1fe48e25aaf376cdc8a1129918b4d8bf) |
| Pinned to a branch | A branch can change after it is checked, so a listing must name a full commit. Code decides. | `LISTING_NOT_PINNED` (code) | No | [listed](https://sepolia.etherscan.io/tx/0xa321659a28d45b996e3ebf2a81baefd610cd53fa52e3d5bb22b0d9858e7a1b42) · [challenged](https://sepolia.etherscan.io/tx/0x8da45f8e8b4f920c921f5af1b488e76387a5363678987abd57646177adca4b4b) · [judged](https://explorer-studio.genlayer.com/tx/0xa0c5dcf3e1c4cc5c690a40d2ca39b7a29d591915051ac838653100d586b080fb) · [ruled](https://sepolia.etherscan.io/tx/0x84b15df85252aa218fa14835d3b4ba64e6495547a41dbacc5fcc463d6d1248dd) |
| Nobody ruled in time | A dispute nobody judges. After the deadline an outsider closes it and deposits are returned. | no ruling in time | No | [listed](https://sepolia.etherscan.io/tx/0x1057c23b749db58c38203e9b0f8c7f99a1d1a7c23c0e72aadaa8a397e7a1e138) · [challenged](https://sepolia.etherscan.io/tx/0xa94b8603d62eefa7b4b588e91e64a531c4684c6121b2fdc17c27fd74a4840ebd) · [closed](https://sepolia.etherscan.io/tx/0x57b5065b35c1be83d5a1758243218cdcda8d9d45c234c22f5859a8db4c0dd53b) |
| Listed, then caught | Nobody challenged it in time, so it was listed. A hunter then asked for its removal. | registered unchallenged, then removal: `MALICIOUS` (validators) | No | [listed](https://sepolia.etherscan.io/tx/0xaae19d18c1d520fbc0690a60936515f56c625f90ef999dba8e8a78669e8ffcae) · [registered](https://sepolia.etherscan.io/tx/0x070e363757765d22fae0efcd634cd39e7b53d5c1370a2bbd74a064a7c61094a3) · [removal asked](https://sepolia.etherscan.io/tx/0x7e421d8cc16c098537083e1f8971bbca33fa695f6595f035dae0d72dd01bdc68) · [removal judged](https://explorer-studio.genlayer.com/tx/0xe3e4dff0c3771f33791abc6b89c5c37a1c28d9d4b4b12b9c73869c2a834e83e2) · [removal ruled](https://sepolia.etherscan.io/tx/0xd49dcbed1764e9c25f617f7ea5768b7c6a13170eca77c735bfc91af85a280922) |

13 of 13 ended as designed.
<!--/CASES-->

Guards that failed as designed on GenLayer: <!--GUARDS-->[`quote_tx_mismatch`](https://explorer-studio.genlayer.com/tx/0xa3d5a9ee4be67856ef535c4f6fdece8cf4e8d10b84afbb9096c9ce029087eab9), [`dispute_not_found`](https://explorer-studio.genlayer.com/tx/0xa04fc06771aed0aaa453d43c2f8eade74ce8b7c2458de2b787d473bd6845e234), [`dispute_already_judged`](https://explorer-studio.genlayer.com/tx/0xbd92cadacda01059595c51fd6064c05d18bc6cafa8dd6de7525882b5a85bdb31).<!--/GUARDS-->

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
| `site/` | One-page site with a live checker |
| `docs/` | Design and list policy |

## License

MIT
