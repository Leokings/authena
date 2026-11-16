#!/usr/bin/env tsx
// Prints where every demo listing stands on the Curate list right now.
import { readFileSync } from "node:fs";
import { status } from "./curate-lib";

const state = JSON.parse(readFileSync("deployments/demo-state.json", "utf8"));
for (const key of Object.keys(state).filter((k) => k.endsWith("/list"))) {
  console.log(key.replace("/list", "").padEnd(28), await status(state[key].itemId));
}
