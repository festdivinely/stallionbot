// Checks the Split Money rules (server/src/risk/splitMoney.ts) without a database and without
// Deriv: nothing is bought, the "trades" here are only the pot bookkeeping.
// Run: npx tsx scripts/test-split-money.ts
import assert from "node:assert/strict";
import * as split from "../src/risk/splitMoney.js";

const saved = new Map<string, unknown>();
split._useStoreForTests({
  dbReady: () => true,
  loadState: async <T>(u: string, a: string) => (saved.get(`${a}:${u}`) as T) ?? null,
  loadAllStates: async <T>() => [] as { userId: string; account: "demo" | "real"; data: T }[],
  saveState: async (u: string, a: string, d: unknown) => void saved.set(`${a}:${u}`, structuredClone(d)),
  deleteState: async (u: string, a: string) => void saved.delete(`${a}:${u}`),
});

const U = "user1";
const pot = (id: string) => split.viewOf(U, "demo", 5000).exists && split.viewOf(U, "demo", 5000).pots!.find((p) => p.id === id)!;
let passed = 0;
const check = (name: string, fn: () => void | Promise<void>) =>
  Promise.resolve(fn()).then(() => {
    passed++;
    console.log("  ok -", name);
  });

const settings = { ...split.DEFAULT_SETTINGS, sections: 10, sectionAmount: 10, banks: [100, 1000] };

await check("set up needs a big enough balance", async () => {
  const r = await split.saveSettings(U, "demo", settings, 500);
  assert.equal(r.ok, false);
});
await check("set up 10 × $10 + $100 + $1,000", async () => {
  assert.equal((await split.saveSettings(U, "demo", settings, 5000)).ok, true);
  assert.equal(pot("s1")!.balance, 10);
  assert.equal(pot("b2")!.balance, 1000);
});
await check("no pot needed while the strategy is off", () => {
  assert.equal(split.reservePotTrade(U, "demo", undefined, 5).ok, true);
});
await check("start the strategy", async () => {
  assert.equal((await split.setActive(U, "demo", true, 5000)).ok, true);
});
await check("a pot is required once it is on", () => {
  assert.equal(split.reservePotTrade(U, "demo", undefined, 1).ok, false);
});
await check("a stake above the pot's money is refused", () => {
  assert.equal(split.reservePotTrade(U, "demo", "s1", 10.01).ok, false);
});
await check("a pot can stake all of its money", () => {
  assert.equal(split.reservePotTrade(U, "demo", "s1", 10).ok, true);
  split.releasePotTrade(U, "demo", "s1");
  assert.equal(pot("s1")!.balance, 10);
});
await check("a $5 trade from S1 takes $5 out, a loss leaves $5", () => {
  assert.equal(split.reservePotTrade(U, "demo", "s1", 5).ok, true);
  split.confirmPotTrade(U, "demo", "s1", 111, 5, { symbol: "R_100", contractType: "CALL" });
  assert.equal(pot("s1")!.balance, 5);
  split.settlePotTrade(U, "demo", 111, -5);
  assert.equal(pot("s1")!.balance, 5);
});
await check("a win pays stake + profit back into the pot", () => {
  assert.equal(split.reservePotTrade(U, "demo", "s1", 2.5).ok, true);
  split.confirmPotTrade(U, "demo", "s1", 112, 2.5, { symbol: "R_100", contractType: "CALL" });
  split.settlePotTrade(U, "demo", 112, 2.29);
  assert.equal(pot("s1")!.balance, 7.29);
});
await check("a failed buy gives the stake back", () => {
  assert.equal(split.reservePotTrade(U, "demo", "s2", 3).ok, true);
  split.releasePotTrade(U, "demo", "s2");
  assert.equal(pot("s2")!.balance, 10);
});
await check("an empty pot locks, and can't borrow during the cool-down", async () => {
  for (let i = 0; i < 6; i++) {
    const p = pot("s3")!;
    if (p.locked) break;
    assert.equal(split.reservePotTrade(U, "demo", "s3", p.maxStake).ok, true);
    split.confirmPotTrade(U, "demo", "s3", 200 + i, p.maxStake, { symbol: "R_100", contractType: "PUT" });
    split.settlePotTrade(U, "demo", 200 + i, -p.maxStake);
  }
  assert.equal(pot("s3")!.locked, true);
  assert.equal(split.reservePotTrade(U, "demo", "s3", 0.35).ok, false);
  assert.equal((await split.lend(U, "demo", "b1", "s3", 10)).ok, false); // cool-down
});
await check("the $1,000 bank can't lend straight to a section", async () => {
  assert.equal((await split.lend(U, "demo", "b2", "s4", 10)).ok, false);
});
await check("a bank can't lend more than it has", async () => {
  assert.equal((await split.lend(U, "demo", "b1", "s4", 150)).ok, false);
});
await check("the $100 bank lends $10 to S4; S4 can't borrow twice", async () => {
  assert.equal((await split.lend(U, "demo", "b1", "s4", 10)).ok, true);
  assert.equal(pot("s4")!.balance, 20);
  assert.equal(pot("b1")!.balance, 90);
  assert.equal(pot("s4")!.owes, 10);
  assert.equal((await split.lend(U, "demo", "s5", "s4", 1)).ok, false);
});
await check("the $1,000 bank lends to the $100 bank", async () => {
  assert.equal((await split.lend(U, "demo", "b2", "b1", 50)).ok, true);
  assert.equal(pot("b1")!.balance, 140);
});
await check("paying back part of a loan", async () => {
  const loan = split.viewOf(U, "demo", 5000).loans!.find((l) => l.to === "s4")!;
  assert.equal((await split.repay(U, "demo", loan.id, 4)).ok, true);
  assert.equal(pot("s4")!.owes, 6);
  assert.equal(pot("b1")!.balance, 144);
});
await check("a due loan is collected automatically", async () => {
  const view = split.viewOf(U, "demo", 5000);
  const loan = view.loans!.find((l) => l.to === "b1")!;
  const realNow = Date.now;
  Date.now = () => loan.dueAt + 1000; // pretend the 24 hours have passed
  try {
    await split._tickForTests();
  } finally {
    Date.now = realNow;
  }
  assert.equal(pot("b1")!.owes, 0);
  assert.equal(pot("b2")!.balance, 1000);
});
await check("a balance below the pots pauses the strategy", () => {
  split.checkDerivBalance("demo", 100);
  const r = split.reservePotTrade(U, "demo", "s5", 1);
  assert.equal(r.ok, false);
  assert.match((r as { message: string }).message, /paused/);
});
await check("adjusting shrinks the pots (top bank first) and resumes", async () => {
  assert.equal((await split.adjustToBalance(U, "demo", 1100)).ok, true);
  const v = split.viewOf(U, "demo", 1100);
  assert.equal(v.held, 1100);
  assert.equal(v.pause, null);
  assert.equal(split.reservePotTrade(U, "demo", "s5", 1).ok, true);
  split.releasePotTrade(U, "demo", "s5");
});
await check("demo and real are separate", () => {
  assert.equal(split.viewOf(U, "real", 5000).exists, false);
  assert.equal(split.reservePotTrade(U, "real", undefined, 1).ok, true);
});
await check("the daily loss cap stops trading", async () => {
  await split.saveSettings(U, "demo", { ...split.viewOf(U, "demo", 5000).settings!, dailyLossCap: 1 }, 5000);
  const r = split.reservePotTrade(U, "demo", "s6", 5);
  assert.equal(r.ok, false);
});
await check("everything was saved", () => {
  assert.ok(saved.has(`demo:${U}`));
});

console.log(`\n${passed} checks passed`);
process.exit(0);
