#!/usr/bin/env node
// Compiles the Solidity contracts with solc-js and writes ABI + bytecode to evm/artifacts/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const solc = createRequire(import.meta.url)("solc");
const sources = {
  "GenLayerArbitrator.sol": "evm/GenLayerArbitrator.sol",
  "MockArbitrable.sol": "evm/test/MockArbitrable.sol",
};
const input = {
  language: "Solidity",
  sources: Object.fromEntries(Object.entries(sources).map(([name, path]) => [name, { content: readFileSync(path, "utf8") }])),
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (out.errors ?? []).filter((e) => e.severity === "error");
for (const e of out.errors ?? []) console.error(e.formattedMessage);
if (errors.length) process.exit(1);

mkdirSync("evm/artifacts", { recursive: true });
for (const [file, contracts] of Object.entries(out.contracts)) {
  for (const [name, c] of Object.entries(contracts)) {
    if (name.startsWith("I")) continue;
    writeFileSync(`evm/artifacts/${name}.json`, JSON.stringify({ contractName: name, source: sources[file], compiler: solc.version(), abi: c.abi, bytecode: "0x" + c.evm.bytecode.object }, null, 2) + "\n");
    console.log(`${name}: ${c.evm.bytecode.object.length / 2} bytes`);
  }
}
