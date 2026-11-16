#!/usr/bin/env node
// Builds deployments/release-manifest.json from the demo state, the saved GenLayer receipts and
// live read-backs from both chains.
//   node scripts/build-manifest.mjs
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, http, parseAbi } from "viem";
import { sepolia as sepoliaChain } from "viem/chains";

const receipts = "deployments/studionet/receipts";
const CONTRACT_FILE = "contracts/skill_court.py";
const source = readFileSync(CONTRACT_FILE, "utf8");
const state = JSON.parse(readFileSync("deployments/demo-state.json", "utf8"));
const sep = JSON.parse(readFileSync("deployments/sepolia.json", "utf8"));
const court = readFileSync("deployments/studionet/CONTRACT", "utf8").trim();
const demo = JSON.parse(readFileSync("fixtures/demo.json", "utf8"));
const ipfs = existsSync("deployments/ipfs.json") ? JSON.parse(readFileSync("deployments/ipfs.json", "utf8")) : null;
const sh = (cmd) => {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};
const etherscan = (tx) => (tx ? `https://sepolia.etherscan.io/tx/${tx}` : null);
const glExplorer = (tx) => (tx ? `https://explorer-studio.genlayer.com/tx/${tx}` : null);

/** Pulls what matters out of a CLI receipt dump (it is JS-object text, not JSON). */
function readReceipt(label) {
  const file = `${receipts}/${label}.receipt.txt`;
  if (!existsSync(file)) return {};
  const t = readFileSync(file, "utf8");
  const all = (re) => [...t.matchAll(re)].map((m) => m[1]);
  const votes = {};
  for (const m of t.matchAll(/'(0x[0-9A-Fa-f]{40})': '(agree|disagree|idle|timeout|deterministic_violation)'/g)) votes[m[1]] = m[2];
  return {
    status: all(/status_name: '([A-Z_]+)'/g).at(-1) ?? null,
    consensus_result: all(/result_name: '([A-Z_]+)'/g).at(-1) ?? null,
    leader_execution: all(/execution_result: '([A-Z]+)'/g)[0] ?? null,
    leader_error: t.match(/\[(?:EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR)\] [a-z0-9_]+/)?.[0] ?? null,
    votes,
  };
}

const steps = [];
function genlayerStep(label, tx, expectedError) {
  const r = readReceipt(label);
  const expectedFailure = !!expectedError;
  const proof = r.status === "FINALIZED" && (expectedFailure ? r.leader_execution === "ERROR" && r.leader_error === `[EXPECTED] ${expectedError}` : r.leader_execution === "SUCCESS");
  const step = { label, tx, explorer: glExplorer(tx), expected_failure: expectedFailure, ...(expectedFailure ? { expected_error: `[EXPECTED] ${expectedError}` } : {}), ...r, counts_as_proof: proof };
  steps.push(step);
  return step;
}

const pub = createPublicClient({ chain: sepoliaChain, transport: http("https://ethereum-sepolia-rpc.publicnode.com") });
const registryAbi = parseAbi(["function getItemInfo(bytes32) view returns (uint8 status, uint256 numberOfRequests, uint256 sumDeposit)"]);
const STATUS = ["absent", "registered", "registration requested", "removal requested"];
const itemStatus = async (itemId) => STATUS[Number((await pub.readContract({ address: sep.registry, abi: registryAbi, functionName: "getItemInfo", args: [itemId] }))[0])];

const { createClient } = await import("genlayer-js");
const { studionet } = await import("genlayer-js/chains");
const gl = createClient({ chain: studionet });
const verdictOf = (id) => gl.readContract({ address: court, functionName: "get_verdict", args: [id], jsonSafeReturn: true });

genlayerStep("00-deploy", readFileSync(`${receipts}/00-deploy.txt`, "utf8").match(/'Transaction Hash': '(0x[0-9a-f]{64})'/)?.[1] ?? null);

/** One dispute: the relay's record, the GenLayer receipt and the verdict read back from the judge. */
async function dispute(relayed, label, expected) {
  if (!relayed) return null;
  const s = relayed.judge ? genlayerStep(label, relayed.judge.tx) : null;
  const v = await verdictOf(relayed.disputeId);
  return {
    dispute_id: relayed.disputeId,
    request_type: relayed.requestType,
    judge_tx: s?.explorer ?? null,
    genlayer_status: s?.status ?? null,
    leader_execution: s?.leader_execution ?? null,
    votes: s?.votes ?? null,
    ruling_tx: etherscan(relayed.rulingTx),
    verdict: v,
    expected,
    ok: v?.judged === true && v.finding === expected && (!s || s.counts_as_proof) && relayed.relayed === true,
  };
}

const LISTED_AFTER = { MALICIOUS: "absent", LISTING_NOT_PINNED: "absent", BENIGN: "registered", QUOTE_NOT_IN_FILE: "registered" };
const cases = [];
for (const c of demo) {
  const listed = state[`${c.id}/list`];
  if (!listed) continue;
  const entry = {
    id: c.id,
    title: c.title,
    why: c.why,
    flow: c.flow,
    listing: { repo: c.repo, commit: c.commit === "FIX" ? ipfs?.fixturesCommit ?? state.fixturesCommit ?? "FIX" : c.commit, folder: c.folder },
    quote: c.quote ?? null,
    item_id: listed.itemId,
    sepolia: {
      list_tx: etherscan(listed.tx),
      challenge_tx: etherscan(state[`${c.id}/challenge`]?.tx),
      execute_tx: etherscan(state[`${c.id}/execute`]?.tx),
      removal_request_tx: etherscan(state[`${c.id}/removal-request`]?.tx),
      removal_challenge_tx: etherscan(state[`${c.id}/removal-challenge`]?.tx),
      refuse_tx: etherscan(state[`${c.id}/refuse`]?.tx),
    },
    registration: await dispute(state[`${c.id}/relay`], c.id, c.flow === "challenge" ? c.expect : null),
    removal: await dispute(state[`${c.id}/removal-relay`], `${c.id}-removal`, c.flow === "caught-later" ? c.expect : c.then === "false-removal" ? "BENIGN" : null),
    final_status: await itemStatus(listed.itemId),
  };
  let expected;
  if (c.flow === "unchallenged") expected = "registered";
  else if (c.flow === "timeout") expected = "absent";
  else if (c.flow === "caught-later") expected = "absent";
  else expected = LISTED_AFTER[c.expect];
  entry.expected_status = expected;
  entry.as_expected =
    entry.final_status === expected &&
    (c.flow !== "challenge" || entry.registration?.ok === true) &&
    (c.flow !== "caught-later" || entry.removal?.ok === true) &&
    (c.then !== "false-removal" || entry.removal?.ok === true) &&
    (c.flow !== "timeout" || (!!entry.sepolia.refuse_tx && !entry.registration)) &&
    (c.flow !== "unchallenged" || !!entry.sepolia.execute_tx);
  cases.push(entry);
}
for (const [key, label, error] of [
  ["guard/quote-tx-mismatch", "EXPECTED-quote-tx-mismatch", "quote_tx_mismatch"],
  ["guard/dispute-not-found", "EXPECTED-dispute-not-found", "dispute_not_found"],
  ["guard/replay", "EXPECTED-replay-judged-dispute", "dispute_already_judged"],
]) {
  if (state[key]) genlayerStep(label, state[key].tx, error);
}

const contractClean = sh(`git status --porcelain ${CONTRACT_FILE}`) === "";
const contractCommit = contractClean ? sh(`git log -1 --format=%H -- ${CONTRACT_FILE}`) : null;
const probe = existsSync("deployments/studionet/PROBE") ? readFileSync("deployments/studionet/PROBE", "utf8").trim() : null;
const probeRun = (label, result) => ({ label, tx: readFileSync(`${receipts}/${label}.write.txt`, "utf8").match(/0x[0-9a-f]{64}/)?.[0] ?? null, ...readReceipt(label), result });
const manifest = {
  project: "Authena",
  mission: "Internet Court: Partner Demo Lab",
  partner: "Kleros (Curate)",
  genlayer: {
    network: { name: "studionet", chain_id: 61999, rpc: "https://studio.genlayer.com/api", explorer: "https://explorer-studio.genlayer.com" },
    contract: {
      address: court,
      explorer: `https://explorer-studio.genlayer.com/address/${court}`,
      file: CONTRACT_FILE,
      runner: source.match(/py-genlayer:([0-9a-z]+)/)?.[1] ?? null,
      sha256: createHash("sha256").update(source).digest("hex"),
      git_blob: sh(`git hash-object ${CONTRACT_FILE}`),
      // The last commit that changed the contract, so later commits keep pointing at the deployed source.
      git_commit: contractCommit,
      git_blob_at_commit: contractCommit ? sh(`git rev-parse ${contractCommit}:${CONTRACT_FILE}`) : null,
      git_clean_for_contract: contractClean,
      constructor_args: [sep.registry, sep.arbitrator],
      deploy_tx: steps[0].tx,
      deployed_source_identical: null,
    },
    deployer: sh("genlayer account 2>&1 | grep -oE \"address: '0x[0-9a-fA-F]{40}'\" | grep -oE '0x[0-9a-fA-F]{40}'"),
    probe: probe
      ? {
          file: "contracts/probe.py",
          address: probe,
          runs: [
            probeRun("probe-2", "The leader and validators fetched Kleros's factory code from a public Sepolia node and a pinned file from raw.githubusercontent.com, and returned identical hashes."),
            ...(existsSync(`${receipts}/probe-3-kleros-cdn.write.txt`) ? [probeRun("probe-3-kleros-cdn", "The same for a file on Kleros's IPFS gateway (cdn.kleros.link).")] : []),
          ],
          failed_attempt: "probe-1 failed on an operator mistake: the first probe did not accept the CLI's address-typed argument. Fixed and rerun as probe-2.",
        }
      : null,
  },
  sepolia: {
    chain_id: 11155111,
    kleros_factory: sep.factory,
    registry: sep.registry,
    curate_url: `https://curate.kleros.io/tcr/11155111/${sep.registry}`,
    registry_deploy_tx: etherscan(sep.registryDeployTx),
    arbitrator: sep.arbitrator,
    arbitrator_deploy_tx: etherscan(sep.arbitratorDeployTx),
    arbitrator_source: sep.arbitratorSource,
    arbitrator_compiler: sep.compiler,
    relayer: sep.relayer,
    deposit_wei: sep.depositWei,
    challenge_period_seconds: sep.challengePeriodSeconds,
    ruling_timeout_seconds: sep.rulingTimeoutSeconds,
    policy: sep.policy,
    registration_meta_evidence: sep.registrationMetaEvidence ?? null,
    clearing_meta_evidence: sep.clearingMetaEvidence ?? null,
  },
  ipfs: ipfs ? { gateway: "https://cdn.kleros.link", fixtures_commit: ipfs.fixturesCommit, list: ipfs.list, files: Object.values(ipfs.bySha).map((f) => ({ name: f.name, cid: f.cid })) } : null,
  toolchain: {
    node: process.version,
    genlayer_cli: sh("genlayer --version"),
    genlayer_js: JSON.parse(readFileSync("node_modules/genlayer-js/package.json", "utf8")).version,
    viem: JSON.parse(readFileSync("node_modules/viem/package.json", "utf8")).version,
    solc: JSON.parse(readFileSync("node_modules/solc/package.json", "utf8")).version,
    genvm_linter: sh("python -m pip show genvm-linter")?.match(/Version: (\S+)/)?.[1] ?? null,
    genlayer_test: sh("python -m pip show genlayer-test")?.match(/Version: (\S+)/)?.[1] ?? null,
  },
  cases,
  genlayer_steps: steps,
  superseded: [
    "deployments/superseded/first-attempt: the first run was rejected because the CLI turns transaction hashes into numbers. No dispute was judged.",
    "deployments/superseded/v1-inline: the first complete run (6 cases, 8 judgment tests, 3 guards, all as expected), with listings written straight into the transaction. Replaced so the list can show on Kleros's website.",
  ],
  not_proven: [
    "The relay is one key held by this project. Each ruling on Sepolia stores the GenLayer transaction it came from, so it can be checked, but the relay must be trusted to pass rulings on.",
    "Files on IPFS are fetched through Kleros's gateway and checked against their address, so the gateway cannot swap them. Only version-0 addresses of single-block files (under 256 KB) are accepted.",
    "Test networks only (GenLayer StudioNet, Ethereum Sepolia). Deposits are test ETH.",
    "The publisher and the hunter are both this project's wallets. Only this repository's own fixture skills were accused.",
    "The judge reads one quoted passage and about 1,500 characters either side. It does not run code and does not see the rest of a large file.",
    "No UNCLEAR verdict was produced live; that path is covered by direct tests only.",
  ],
};

try {
  const code = await gl.getContractCode(court);
  manifest.genlayer.contract.deployed_source_identical = code === source;
  manifest.genlayer.contract.deployed_sha256 = createHash("sha256").update(code).digest("hex");
} catch (e) {
  manifest.genlayer.contract.deployed_source_identical = `check failed: ${e.message}`;
}

writeFileSync("deployments/release-manifest.json", JSON.stringify(manifest, null, 2) + "\n");
const badSteps = steps.filter((s) => !s.counts_as_proof);
const badCases = cases.filter((c) => !c.as_expected);
console.log(`${steps.length} GenLayer steps, ${steps.length - badSteps.length} count as proof${badSteps.length ? `; not proof: ${badSteps.map((s) => s.label).join(", ")}` : ""}`);
console.log(`${cases.length} cases, ${cases.length - badCases.length} as expected${badCases.length ? `; not as expected: ${badCases.map((c) => c.id).join(", ")}` : ""}`);
console.log(`deployed source identical: ${manifest.genlayer.contract.deployed_source_identical}`);
