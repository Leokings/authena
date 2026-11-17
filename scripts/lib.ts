// Shared Sepolia clients, addresses and ABIs for the Authena scripts.
import { existsSync, readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

export const RPC = process.env.SEPOLIA_RPC ?? "https://ethereum-sepolia-rpc.publicnode.com";
export const FACTORY = "0x3FB8314C628E9afE7677946D3E23443Ce748Ac17" as const; // Kleros LightGTCRFactory, Sepolia
export const DEPLOYMENT = "deployments/sepolia.json";
export const WALLETS = "data/demo-wallets.json"; // gitignored

export const pub = createPublicClient({ chain: sepolia, transport: http(RPC, { retryCount: 8, retryDelay: 2000, timeout: 30_000 }) });

/** The deployer and relayer key comes from the environment and is never printed. */
export function signerKey(): Hex {
  const key = process.env.AUTHENA_SIGNER_KEY ?? process.env.AGENTSCORE_SIGNER_KEY;
  if (!key) throw new Error("Set AUTHENA_SIGNER_KEY (run with --env-file pointing at your .env). Never paste it into chat.");
  return (key.startsWith("0x") ? key : `0x${key}`) as Hex;
}

export function wallet(key: Hex) {
  return createWalletClient({ account: privateKeyToAccount(key), chain: sepolia, transport: http(RPC, { retryCount: 8, retryDelay: 2000, timeout: 30_000 }) });
}

/** A demo role's wallet (publisher or hunter), created by scripts/demo-wallets.ts. */
export function roleWallet(role: "publisher" | "hunter") {
  if (!existsSync(WALLETS)) throw new Error(`${WALLETS} is missing. Run scripts/demo-wallets.ts first.`);
  return wallet(JSON.parse(readFileSync(WALLETS, "utf8"))[role].key);
}

export function deployment(): { arbitrator: Hex; registry: Hex; fromBlock: string; [k: string]: unknown } {
  if (!existsSync(DEPLOYMENT)) throw new Error(`${DEPLOYMENT} is missing. Run scripts/deploy-sepolia.ts first.`);
  return JSON.parse(readFileSync(DEPLOYMENT, "utf8"));
}

export function artifact(name: string): { abi: any[]; bytecode: Hex } {
  return JSON.parse(readFileSync(`evm/artifacts/${name}.json`, "utf8"));
}

export const factoryAbi = parseAbi([
  "event NewGTCR(address indexed _address)",
  "function deploy(address _arbitrator, bytes _arbitratorExtraData, address _connectedTCR, string _registrationMetaEvidence, string _clearingMetaEvidence, address _governor, uint256[4] _baseDeposits, uint256 _challengePeriodDuration, uint256[3] _stakeMultipliers, address _relayContract)",
]);

export const registryAbi = parseAbi([
  "event NewItem(bytes32 indexed _itemID, string _data, bool _addedDirectly)",
  "event RequestSubmitted(bytes32 indexed _itemID, uint256 _evidenceGroupID)",
  "event Evidence(address indexed _arbitrator, uint256 indexed _evidenceGroupID, address indexed _party, string _evidence)",
  "event Dispute(address indexed _arbitrator, uint256 indexed _disputeID, uint256 _metaEvidenceID, uint256 _evidenceGroupID)",
  "event ItemStatusChange(bytes32 indexed _itemID, bool _updatedDirectly)",
  "function addItem(string _item) payable",
  "function removeItem(bytes32 _itemID, string _evidence) payable",
  "function challengeRequest(bytes32 _itemID, string _evidence) payable",
  "function executeRequest(bytes32 _itemID)",
  "function getItemInfo(bytes32 _itemID) view returns (uint8 status, uint256 numberOfRequests, uint256 sumDeposit)",
  "function arbitratorDisputeIDToItemID(address, uint256) view returns (bytes32)",
  "function arbitrator() view returns (address)",
  "function challengePeriodDuration() view returns (uint256)",
  "function submissionBaseDeposit() view returns (uint256)",
  "function removalBaseDeposit() view returns (uint256)",
  "function submissionChallengeBaseDeposit() view returns (uint256)",
  "function removalChallengeBaseDeposit() view returns (uint256)",
]);

/** Curate item status, as getItemInfo returns it. */
export const STATUS = ["absent", "registered", "registration requested", "removal requested"] as const;

export const explorerTx = (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`;
