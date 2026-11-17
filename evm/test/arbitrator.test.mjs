// Local tests for GenLayerArbitrator against a stand-in Curate list, on an in-process chain.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { before, test } from "node:test";
import { createPublicClient, createWalletClient, custom, keccak256, parseEther, toBytes, toFunctionSelector } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";

const ganache = createRequire(import.meta.url)("ganache");
const MNEMONIC = "test test test test test test test test test test test junk";
const provider = ganache.provider({ logging: { quiet: true }, wallet: { mnemonic: MNEMONIC }, chain: { chainId: 31337, hardfork: "merge" } });
const transport = custom(provider);
const pub = createPublicClient({ chain: hardhat, transport });
const [relayer, stranger] = [0, 1].map((i) => createWalletClient({ account: mnemonicToAccount(MNEMONIC, { addressIndex: i }), chain: hardhat, transport }));
const art = (name) => JSON.parse(readFileSync(`evm/artifacts/${name}.json`, "utf8"));
const ARB = art("GenLayerArbitrator");
const MOCK = art("MockArbitrable");
const FEE = parseEther("0.0001");
const TIMEOUT = 600n;
const TX = "0x" + "ab".repeat(32);

let arb, list;

async function deploy(wallet, a, args) {
  const hash = await wallet.deployContract({ abi: a.abi, bytecode: a.bytecode, args });
  return (await pub.waitForTransactionReceipt({ hash })).contractAddress;
}
const write = async (wallet, address, abi, functionName, args = [], value) => {
  const hash = await wallet.writeContract({ address, abi, functionName, args, value });
  return pub.waitForTransactionReceipt({ hash });
};
const read = (address, abi, functionName, args = []) => pub.readContract({ address, abi, functionName, args });
// Simulates the call and checks it reverted with the named custom error (matched by selector,
// because the in-process chain returns the raw revert data).
const fails = (wallet, address, abi, functionName, args, name, value) =>
  assert.rejects(pub.simulateContract({ account: wallet.account, address, abi, functionName, args, value }), (e) => {
    const selector = toFunctionSelector(`${name}()`);
    for (let c = e; c; c = c.cause) if (typeof c.data === "string" && c.data.startsWith(selector)) return true;
    return false;
  });
const challenge = async () => {
  await write(stranger, list, MOCK.abi, "challenge", [], FEE);
  return read(list, MOCK.abi, "lastDispute");
};

before(async () => {
  arb = await deploy(relayer, ARB, [relayer.account.address, FEE, TIMEOUT]);
  list = await deploy(relayer, MOCK, [arb]);
});

test("a dispute opened by the list gets ID 1 and waits", async () => {
  const id = await challenge();
  assert.equal(id, 1n);
  assert.equal(await read(arb, ARB.abi, "disputeStatus", [id]), 0);
  assert.equal(await read(arb, ARB.abi, "disputeCount"), 1n);
  assert.equal(await read(arb, ARB.abi, "arbitrationCost", ["0x"]), FEE);
});

test("opening a dispute without the fee fails", async () => {
  await fails(stranger, list, MOCK.abi, "challenge", [], "FeeTooLow", FEE - 1n);
});

test("only the relayer can give a ruling, and only 0, 1 or 2", async () => {
  await fails(stranger, arb, ARB.abi, "giveRuling", [1n, 2n, TX], "OnlyRelayer");
  await fails(relayer, arb, ARB.abi, "giveRuling", [1n, 3n, TX], "InvalidRuling");
  await fails(relayer, arb, ARB.abi, "giveRuling", [0n, 1n, TX], "NotWaiting");
  await fails(relayer, arb, ARB.abi, "giveRuling", [99n, 1n, TX], "NotWaiting");
});

test("a relayed ruling reaches the list once and records the GenLayer transaction", async () => {
  const receipt = await write(relayer, arb, ARB.abi, "giveRuling", [1n, 2n, TX]);
  // Kleros's Curate index reads the ruling only on the standard AppealPossible event.
  const topic = keccak256(toBytes("AppealPossible(uint256,address)"));
  const appeal = receipt.logs.find((l) => l.topics[0] === topic);
  assert.ok(appeal, "AppealPossible was emitted");
  assert.equal(BigInt(appeal.topics[1]), 1n);
  assert.equal(("0x" + appeal.topics[2].slice(26)).toLowerCase(), list.toLowerCase());
  assert.equal(await read(list, MOCK.abi, "ruled", [1n]), true);
  assert.equal(await read(list, MOCK.abi, "rulings", [1n]), 2n);
  assert.equal(await read(arb, ARB.abi, "disputeStatus", [1n]), 2);
  assert.equal(await read(arb, ARB.abi, "currentRuling", [1n]), 2n);
  assert.equal((await read(arb, ARB.abi, "disputes", [1n]))[4], TX);
  await fails(relayer, arb, ARB.abi, "giveRuling", [1n, 1n, TX], "NotWaiting");
  await fails(stranger, arb, ARB.abi, "refuse", [1n], "NotWaiting");
});

test("a dispute with no ruling can be closed by anyone, but only after the timeout", async () => {
  const id = await challenge();
  await fails(stranger, arb, ARB.abi, "refuse", [id], "TooEarly");
  await provider.request({ method: "evm_increaseTime", params: [Number(TIMEOUT) + 1] });
  await provider.request({ method: "evm_mine", params: [] });
  await write(stranger, arb, ARB.abi, "refuse", [id]);
  assert.equal(await read(list, MOCK.abi, "ruled", [id]), true);
  assert.equal(await read(list, MOCK.abi, "rulings", [id]), 0n);
  await fails(relayer, arb, ARB.abi, "giveRuling", [id, 2n, TX], "NotWaiting");
});

test("there are no appeals", async () => {
  assert.deepEqual(await read(arb, ARB.abi, "appealPeriod", [1n]), [0n, 0n]);
  await fails(stranger, arb, ARB.abi, "appeal", [1n, "0x"], "NoAppeals");
});

test("the court address is set once, by the relayer", async () => {
  await fails(stranger, arb, ARB.abi, "setCourt", ["0xabc"], "OnlyRelayer");
  await write(relayer, arb, ARB.abi, "setCourt", ["0xabc"]);
  assert.equal(await read(arb, ARB.abi, "court"), "0xabc");
  await fails(relayer, arb, ARB.abi, "setCourt", ["0xdef"], "CourtAlreadySet");
});

test("fees can be withdrawn by the relayer only", async () => {
  await fails(stranger, arb, ARB.abi, "withdrawFees", [], "OnlyRelayer");
  assert.equal(await pub.getBalance({ address: arb }), FEE * 2n);
  await write(relayer, arb, ARB.abi, "withdrawFees");
  assert.equal(await pub.getBalance({ address: arb }), 0n);
});
