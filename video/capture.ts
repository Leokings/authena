#!/usr/bin/env tsx
/**
 * Captures the real product for the video, at 1920x1080 and 2x pixel density: the live Authena
 * site (including a real check), the list on Kleros Curate, one item's page there, and the
 * GenLayer explorer page of the judgment. Writes PNGs to public/shots.
 *
 *   npx tsx capture.ts
 */
import { mkdirSync, readFileSync } from "node:fs";
import puppeteer, { type Page } from "puppeteer-core";

const CHROME = "node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe";
const SITE = "https://authena-sepia.vercel.app/";
const m = JSON.parse(readFileSync("../deployments/release-manifest.json", "utf8"));
const poisoned = m.cases.find((c: any) => c.id === "poisoned-uploader");
const fix = m.ipfs.fixtures_commit;
const OUT = "public/shots";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shot = async (p: Page, name: string, full = false) => {
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log(`✓ ${name}`);
};

// 1. The site: the hero, then a real check of the poisoned skill.
await page.goto(SITE, { waitUntil: "networkidle0", timeout: 90_000 });
await page.evaluate(() => document.fonts.ready);
await sleep(1500);
await shot(page, "site-hero");
const link = `github.com/Leokings/authena/tree/${fix}/fixtures/skills/poisoned-do-not-install`;
await page.type("#q", link, { delay: 0 });
await shot(page, "site-typed");
await page.click("button[type=submit]");
await page.waitForFunction(() => {
  const s = document.querySelector("#out .stamp")?.textContent;
  return s && s !== "…";
}, { timeout: 90_000 });
await sleep(900);
await shot(page, "site-busted");
// A clean one, for contrast.
await page.evaluate(() => ((document.querySelector("#q") as HTMLInputElement).value = ""));
await page.type("#q", `github.com/Leokings/authena/tree/${fix}/fixtures/skills/file-uploader`, { delay: 0 });
await page.click("button[type=submit]");
await page.waitForFunction(() => document.querySelector("#out .stamp")?.textContent === "Clean", { timeout: 90_000 });
await sleep(900);
await shot(page, "site-clean");
// The case files.
await page.evaluate(() => document.getElementById("cases")?.scrollIntoView());
await sleep(800);
await shot(page, "site-cases");

// 2. Kleros Curate: the list, with its content filter off so every item shows.
const curate = await browser.newPage();
await curate.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
await curate.goto(m.sepolia.curate_url, { waitUntil: "networkidle2", timeout: 120_000 });
await curate.waitForFunction(() => document.body.innerText.includes("Authena: Safe Agent Skills") && document.body.innerText.includes("Registered"), { timeout: 120_000 });
await sleep(2500);
const toggled = await curate.evaluate(() => {
  const sw = document.querySelector("[role=switch]") as HTMLElement | null;
  if (sw) sw.click();
  return !!sw;
});
await sleep(2500);
console.log(`filter switch found: ${toggled}`);
await shot(curate, "curate-list");

// One item's page on Curate: the rejected poisoned uploader.
const itemUrl = `${m.sepolia.curate_url}/${poisoned.item_id}`;
await curate.goto(itemUrl, { waitUntil: "networkidle2", timeout: 120_000 });
await sleep(6000);
await shot(curate, "curate-item");
await curate.evaluate(() => window.scrollBy(0, 700));
await sleep(1500);
await shot(curate, "curate-item-evidence");

// 3. GenLayer explorer: the judgment of the poisoned uploader.
const gl = await browser.newPage();
await gl.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
await gl.goto(poisoned.registration.judge_tx, { waitUntil: "networkidle2", timeout: 120_000 });
await gl.waitForFunction(() => document.body.innerText.includes("FINALIZED"), { timeout: 120_000 });
await sleep(2000);
await shot(gl, "genlayer-tx");
await gl.evaluate(() => {
  const el = [...document.querySelectorAll("*")].find((e) => e.textContent?.trim() === "GenVM Execution");
  el?.scrollIntoView();
});
await sleep(1200);
await shot(gl, "genlayer-tx-result");

await browser.close();
