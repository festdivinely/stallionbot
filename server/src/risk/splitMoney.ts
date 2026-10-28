// The "Split Money" strategy: part of the trader's Deriv balance is split into small pots, and every
// trade may only use the money in the pot it was placed from.
//
//   layer 0      N sections of the same amount (e.g. 10 × $10)
//   layer 1..k   one bank per layer, usually 10× the layer below ($100, then $1,000...)
//
// Rules (all enforced here, on the server):
//  - A trade's stake can be anything up to all the money in its pot. The stake is taken from
//    the pot when bought; the payout goes back into the same pot when the trade ends.
//  - A pot below MIN_STAKE is locked until money is lent to it.
//  - A bank lends only to the layer directly below it; a section may lend to another section.
//    Nobody lends more than they have, and a pot with an unpaid loan can't borrow again.
//  - Every loan is a debt, due loanHours after it was made. From then on it is collected
//    automatically (every minute) from whatever the borrower has, until paid in full.
//  - A pot that just ran out can't borrow for coolDownMin minutes (no chasing losses).
//  - Daily loss cap: today's strategy losses + stakes still at risk may not pass dailyLossCap.
//  - If the real Deriv balance drops below what the pots hold (normal trades, deriv.com...), the
//    strategy is TURNED OFF, with the reason kept for the app to show. Adjusting the pots down to
//    the balance turns it back on.
// Only trades sent WITH a pot (from the Split Money trading screen) follow these rules; normal
// trades (the plain Options screen) don't. These checks come IN ADDITION to
// server/src/risk/index.ts, never instead of it.
//
// The state lives in memory (all changes are instant and in one place, so there are no races) and
// is saved to MongoDB after every change (splitMoneyStore.ts), so a server restart loses nothing.
import type { AccountType } from "./index.js";
import * as dbStore from "./splitMoneyStore.js";

// Where the state is saved: MongoDB, or an in-memory stand-in for tests (_useStoreForTests)
let store: Pick<typeof dbStore, "dbReady" | "loadState" | "loadAllStates" | "saveState" | "deleteState"> = dbStore;

/** Smallest stake Deriv allows on most options: a pot below this is "locked". */
export const MIN_STAKE = 0.35;
const HISTORY_MAX = 150;
const TICK_MS = 60_000;

export interface SplitSettings {
  sections: number;
  sectionAmount: number;
  /** One amount per bank layer, lowest bank first (e.g. [100, 1000]) */
  banks: number[];
  loanHours: number;
  coolDownMin: number;
  dailyLossCap: number;
}

export const DEFAULT_SETTINGS: SplitSettings = {
  sections: 10,
  sectionAmount: 10,
  banks: [100, 1000],
  loanHours: 24,
  coolDownMin: 15,
  dailyLossCap: 100,
};

interface Pot {
  id: string; // "s1".."sN" for sections, "b1".. for banks (b1 = lowest bank)
  layer: number; // 0 = sections, 1.. = banks
  start: number;
  balance: number; // money free to trade or lend (stakes of open trades already taken out)
  noBorrowUntil?: number; // epoch ms: cool-down after running out
}

interface Loan {
  id: string;
  from: string;
  to: string;
  amount: number;
  owed: number;
  createdAt: number;
  dueAt: number;
}

interface OpenTrade {
  contractId: number;
  potId: string;
  stake: number;
  symbol?: string;
  contractType?: string;
}

interface State {
  settings: SplitSettings;
  active: boolean;
  /** Why the server turned the strategy off (shown in the app until it's turned on again) */
  offReason: { kind: "balance"; text: string } | null;
  pots: Pot[];
  loans: Loan[];
  open: OpenTrade[];
  day: string;
  dayNet: number; // today's settled strategy profit (negative = loss)
  history: { at: number; text: string }[];
  nextLoanId: number;
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => `$${r2(n).toFixed(2)}`;
const today = () => new Date().toISOString().slice(0, 10);
const keyOf = (userId: string, type: AccountType) => `${type}:${userId}`;

const states = new Map<string, State | null>(); // null = this user has no strategy on this account
const loading = new Map<string, Promise<State | null>>();
const dirty = new Set<string>();
let saving: Promise<void> = Promise.resolve();

// ---------- Change notifications (the trading module wakes the app's live updates) ----------

const changeHandlers = new Set<(userId: string, type: AccountType) => void>();
export function onPotsChange(handler: (userId: string, type: AccountType) => void): void {
  changeHandlers.add(handler);
}

function changed(userId: string, type: AccountType): void {
  dirty.add(keyOf(userId, type));
  saveSoon();
  for (const h of changeHandlers) h(userId, type);
}

function saveSoon(): void {
  // One save at a time, in order; whatever fails stays dirty and is retried on the next tick
  saving = saving.then(async () => {
    for (const key of [...dirty]) {
      const s = states.get(key);
      const [type, userId] = [key.slice(0, key.indexOf(":")) as AccountType, key.slice(key.indexOf(":") + 1)];
      try {
        if (s) await store.saveState(userId, type, s);
        else await store.deleteState(userId, type);
        dirty.delete(key);
      } catch (err) {
        console.error("[split] save failed, will retry:", (err as Error).message);
        return;
      }
    }
  });
}

// ---------- Loading ----------

/** Loads this user's strategy for this account (once); null when they have none. */
export async function ensureLoaded(userId: string, type: AccountType): Promise<State | null> {
  const key = keyOf(userId, type);
  if (states.has(key)) return states.get(key)!;
  if (!loading.has(key)) {
    loading.set(
      key,
      store.loadState<State>(userId, type)
        .then((s) => {
          if (!states.has(key)) states.set(key, upgrade(s));
          return states.get(key)!;
        })
        .finally(() => loading.delete(key))
    );
  }
  return loading.get(key)!;
}

const get = (userId: string, type: AccountType) => states.get(keyOf(userId, type)) ?? null;

/** States saved by older versions: "pause" became "offReason" (and a paused strategy is now off). */
function upgrade(s: State | null): State | null {
  if (!s) return s;
  const old = s as State & { pause?: State["offReason"] };
  if (old.offReason === undefined) {
    old.offReason = old.pause ?? null;
    if (old.pause) old.active = false;
  }
  delete old.pause;
  return old;
}

function newDay(s: State): void {
  if (s.day !== today()) {
    s.day = today();
    s.dayNet = 0;
  }
}

function log(s: State, text: string): void {
  s.history.unshift({ at: Date.now(), text });
  if (s.history.length > HISTORY_MAX) s.history.length = HISTORY_MAX;
}

// ---------- Labels and views ----------

function label(s: State, potId: string): string {
  const pot = s.pots.find((p) => p.id === potId);
  if (!pot) return potId;
  if (pot.layer === 0) return `Section ${potId.slice(1)}`;
  return s.settings.banks.length === 1 ? "Bank" : `Bank ${pot.layer}`;
}

const owedBy = (s: State, potId: string) => r2(s.loans.filter((l) => l.to === potId).reduce((a, l) => a + l.owed, 0));
const owedTo = (s: State, potId: string) => r2(s.loans.filter((l) => l.from === potId).reduce((a, l) => a + l.owed, 0));
const atRisk = (s: State) => r2(s.open.reduce((a, o) => a + o.stake, 0));
/** Money the pots hold right now (excluding stakes in open trades, which Deriv has also taken). */
const held = (s: State) => r2(s.pots.reduce((a, p) => a + p.balance, 0));

/** Largest stake this pot may use now: all its money (0 once it is below the minimum stake). */
function maxStakeOf(pot: Pot): number {
  return pot.balance < MIN_STAKE ? 0 : r2(pot.balance);
}

function dailyRoom(s: State): number {
  newDay(s);
  return r2(Math.max(0, s.settings.dailyLossCap - Math.max(0, -s.dayNet) - atRisk(s)));
}

/** Everything the app shows on the Split Money screen. */
export function viewOf(userId: string, type: AccountType, derivBalance: number | null) {
  const s = get(userId, type);
  if (!s) return { exists: false as const, defaults: DEFAULT_SETTINGS, minStake: MIN_STAKE, derivBalance };
  newDay(s);
  const now = Date.now();
  return {
    exists: true as const,
    settings: s.settings,
    active: s.active,
    offReason: s.offReason,
    minStake: MIN_STAKE,
    derivBalance,
    held: held(s),
    atRisk: atRisk(s),
    dayNet: r2(s.dayNet),
    dailyRoom: dailyRoom(s),
    pots: s.pots.map((p) => ({
      id: p.id,
      label: label(s, p.id),
      layer: p.layer,
      start: p.start,
      balance: r2(p.balance),
      locked: p.balance < MIN_STAKE,
      maxStake: maxStakeOf(p),
      owes: owedBy(s, p.id),
      lent: owedTo(s, p.id),
      coolDownLeftMin: p.noBorrowUntil && p.noBorrowUntil > now ? Math.ceil((p.noBorrowUntil - now) / 60_000) : 0,
      openTrades: s.open.filter((o) => o.potId === p.id).length,
    })),
    loans: s.loans.map((l) => ({ ...l, fromLabel: label(s, l.from), toLabel: label(s, l.to), overdue: l.dueAt <= now })),
    history: s.history.slice(0, 60),
  };
}

/** The short version for the Split Money trading screen's live updates (null: not set up). */
export function summaryOf(userId: string, type: AccountType) {
  const s = get(userId, type);
  if (!s) return null;
  newDay(s);
  return {
    active: s.active,
    offReason: s.offReason,
    dailyRoom: dailyRoom(s),
    pots: s.pots.map((p) => ({ id: p.id, label: label(s, p.id), layer: p.layer, balance: r2(p.balance), locked: p.balance < MIN_STAKE, maxStake: maxStakeOf(p), owes: owedBy(s, p.id) })),
  };
}

// ---------- Setup ----------

function buildPots(settings: SplitSettings): Pot[] {
  const pots: Pot[] = [];
  for (let i = 1; i <= settings.sections; i++) pots.push({ id: `s${i}`, layer: 0, start: settings.sectionAmount, balance: settings.sectionAmount });
  settings.banks.forEach((amount, i) => pots.push({ id: `b${i + 1}`, layer: i + 1, start: amount, balance: amount }));
  return pots;
}

export const totalOf = (settings: SplitSettings) => r2(settings.sections * settings.sectionAmount + settings.banks.reduce((a, b) => a + b, 0));

/** Checks settings sent by the app; returns a reason when something is out of range. */
export function checkSettings(x: SplitSettings): string | null {
  const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (!Number.isInteger(x.sections) || x.sections < 1 || x.sections > 20) return "Sections must be 1 to 20.";
  if (!isNum(x.sectionAmount) || x.sectionAmount < MIN_STAKE || x.sectionAmount > 100_000) return `Each section needs at least ${money(MIN_STAKE)}.`;
  if (!Array.isArray(x.banks) || x.banks.length > 4) return "At most 4 bank layers.";
  for (const b of x.banks) if (!isNum(b) || b < MIN_STAKE || b > 10_000_000) return "Every bank needs an amount above the minimum stake.";
  if (!Number.isInteger(x.loanHours) || x.loanHours < 1 || x.loanHours > 168) return "Loans must be due within 1 to 168 hours.";
  if (!Number.isInteger(x.coolDownMin) || x.coolDownMin < 0 || x.coolDownMin > 240) return "Cool-down must be 0 to 240 minutes.";
  if (!isNum(x.dailyLossCap) || x.dailyLossCap < MIN_STAKE) return "Enter a daily loss cap.";
  return null;
}

/**
 * Saves the settings. First time: every pot starts full. Later (only with no open trades and no
 * unpaid loans): the money the pots hold now is shared out again; money never appears from nowhere.
 * Missing money is taken from the top bank first, extra money goes to the top bank.
 */
export async function saveSettings(userId: string, type: AccountType, settings: SplitSettings, derivBalance: number | null): Promise<Result> {
  const bad = checkSettings(settings);
  if (bad) return { ok: false, message: bad };
  settings = { ...settings, sectionAmount: r2(settings.sectionAmount), banks: settings.banks.map(r2), dailyLossCap: r2(settings.dailyLossCap) };
  const s = await ensureLoaded(userId, type);
  const key = keyOf(userId, type);

  if (!s) {
    const need = totalOf(settings);
    if (derivBalance !== null && derivBalance < need) {
      return { ok: false, message: `These pots need ${money(need)} but your balance is ${money(derivBalance)}. Use smaller amounts.` };
    }
    const fresh: State = { settings, active: false, offReason: null, pots: buildPots(settings), loans: [], open: [], day: today(), dayNet: 0, history: [], nextLoanId: 1 };
    log(fresh, `Set up: ${settings.sections} sections of ${money(settings.sectionAmount)}${settings.banks.length ? `, banks ${settings.banks.map(money).join(" → ")}` : ""} (${money(need)} in total).`);
    states.set(key, fresh);
    changed(userId, type);
    return { ok: true };
  }

  const sameLayout =
    s.settings.sections === settings.sections && s.settings.sectionAmount === settings.sectionAmount && s.settings.banks.join() === settings.banks.join();
  if (!sameLayout) {
    if (s.open.length) return { ok: false, message: "Wait for your open trades to finish before changing the pots." };
    if (s.loans.length) return { ok: false, message: "Clear all loans before changing the pots." };
    const total = held(s);
    const pots = buildPots(settings);
    let diff = r2(total - totalOf(settings)); // + extra money, - missing money
    const top = [...pots].sort((a, b) => b.layer - a.layer || Number(b.id.slice(1)) - Number(a.id.slice(1)));
    if (diff > 0) top[0]!.balance = r2(top[0]!.balance + diff);
    for (const p of top) {
      if (diff >= 0) break;
      const take = Math.min(p.balance, -diff);
      p.balance = r2(p.balance - take);
      diff = r2(diff + take);
    }
    s.pots = pots;
    log(s, `Pots changed: ${settings.sections} sections of ${money(settings.sectionAmount)}${settings.banks.length ? `, banks ${settings.banks.map(money).join(" → ")}` : ""}. The ${money(total)} they held was shared out again.`);
  }
  s.settings = settings;
  if (sameLayout) log(s, "Rules updated.");
  changed(userId, type);
  return { ok: true };
}

export async function setActive(userId: string, type: AccountType, active: boolean, derivBalance: number | null): Promise<Result> {
  const s = await ensureLoaded(userId, type);
  if (!s) return { ok: false, message: "Set up your pots first." };
  if (active && derivBalance !== null && derivBalance < held(s)) {
    return { ok: false, message: `Your balance (${money(derivBalance)}) is below what the pots hold (${money(held(s))}). Adjust the pots first.` };
  }
  if (!active && s.open.length) return { ok: false, message: "Wait for your open trades to finish before turning the strategy off." };
  s.active = active;
  if (active) s.offReason = null;
  log(s, active ? "Strategy turned on: trades from the Split Money screen use a pot." : "Strategy turned off.");
  changed(userId, type);
  return { ok: true };
}

/** Deletes the strategy on this account, so it can be set up fresh. */
export async function resetStrategy(userId: string, type: AccountType): Promise<Result> {
  const s = await ensureLoaded(userId, type);
  if (!s) return { ok: true };
  if (s.open.length) return { ok: false, message: "Wait for your open trades to finish first." };
  states.set(keyOf(userId, type), null);
  changed(userId, type);
  return { ok: true };
}

// ---------- Trading ----------

/** Whether the strategy is on for this user and account. */
export const isActive = (userId: string, type: AccountType) => !!get(userId, type)?.active;

/**
 * Checks a trade against its pot and, if allowed, takes the stake out of the pot at once (so two
 * quick taps can't both spend the same money). Call confirmPotTrade() after Deriv bought it, or
 * releasePotTrade() if the buy failed. A trade without a pot is a normal trade: nothing to check.
 */
export function reservePotTrade(userId: string, type: AccountType, potId: string | undefined, stake: number): Result {
  if (!potId) return { ok: true };
  const s = get(userId, type);
  if (!s) return { ok: false, message: "Set up your Split Money pots first." };
  if (!s.active) {
    return { ok: false, message: s.offReason ? `Split Money is off: ${s.offReason.text}` : "Split Money is off. Turn it on in the Split Money screen." };
  }
  const pot = s.pots.find((p) => p.id === potId);
  if (!pot) return { ok: false, message: "That pot doesn't exist any more. Pick another one." };
  const name = label(s, potId);
  if (pot.balance < MIN_STAKE) return { ok: false, message: `${name} is locked: it has ${money(pot.balance)} left. Lend it money, or trade from another pot.` };
  const max = maxStakeOf(pot);
  if (stake > max) return { ok: false, message: `${name} only has ${money(max)}: the stake can't be more than that.` };
  const room = dailyRoom(s);
  if (stake > room) {
    return { ok: false, message: room >= MIN_STAKE ? `Today's loss cap leaves room for ${money(room)} only.` : `Today's Split Money loss cap of ${money(s.settings.dailyLossCap)} is reached. Trading opens again tomorrow (UTC).` };
  }
  pot.balance = r2(pot.balance - stake);
  s.open.push({ contractId: 0, potId, stake });
  return { ok: true };
}

export function confirmPotTrade(userId: string, type: AccountType, potId: string | undefined, contractId: number, stake: number, info: { symbol: string; contractType: string }): void {
  const s = get(userId, type);
  const o = s?.open.find((x) => x.contractId === 0 && x.potId === potId);
  if (!s || !o) return;
  o.contractId = contractId;
  // Deriv's buy price is normally the stake asked for; if not, charge the pot the real price
  const pot = s.pots.find((p) => p.id === o.potId);
  if (pot && stake !== o.stake) pot.balance = r2(pot.balance - (stake - o.stake));
  o.stake = stake;
  o.symbol = info.symbol;
  o.contractType = info.contractType;
  log(s, `${label(s, o.potId)} bought ${info.contractType} on ${info.symbol} for ${money(stake)}.`);
  changed(userId, type);
}

export function releasePotTrade(userId: string, type: AccountType, potId: string | undefined): void {
  const s = get(userId, type);
  const i = s?.open.findIndex((x) => x.contractId === 0 && x.potId === potId) ?? -1;
  if (!s || i < 0) return;
  const [o] = s.open.splice(i, 1);
  const pot = s.pots.find((p) => p.id === o!.potId);
  if (pot) pot.balance = r2(pot.balance + o!.stake);
}

/** The trade ended: its stake plus profit (what Deriv paid back) goes back into its pot. */
export function settlePotTrade(userId: string, type: AccountType, contractId: number, profit: number): void {
  const s = get(userId, type);
  const i = s?.open.findIndex((x) => x.contractId === contractId) ?? -1;
  if (!s || i < 0) return;
  const [o] = s.open.splice(i, 1);
  newDay(s);
  s.dayNet = r2(s.dayNet + profit);
  const pot = s.pots.find((p) => p.id === o!.potId);
  if (pot) {
    pot.balance = r2(pot.balance + o!.stake + profit);
    if (pot.balance < MIN_STAKE) pot.noBorrowUntil = Date.now() + s.settings.coolDownMin * 60_000;
  }
  log(s, `${label(s, o!.potId)} ${profit >= 0 ? `won ${money(profit)}` : `lost ${money(-profit)}`} (now ${money(pot?.balance ?? 0)}).`);
  collectDue(s, Date.now());
  changed(userId, type);
}

/** Trades still open, for re-following them after a server restart. */
export function openTradesOf(userId: string, type: AccountType): OpenTrade[] {
  return (get(userId, type)?.open ?? []).filter((o) => o.contractId > 0);
}

// ---------- Loans ----------

/** Can `from` lend to `to`? Banks lend to the layer just below; sections lend to sections. */
function canLend(from: Pot, to: Pot): boolean {
  if (from.id === to.id) return false;
  if (from.layer === 0) return to.layer === 0;
  return to.layer === from.layer - 1;
}

export async function lend(userId: string, type: AccountType, fromId: string, toId: string, amount: number): Promise<Result> {
  const s = await ensureLoaded(userId, type);
  if (!s) return { ok: false, message: "Set up your pots first." };
  const from = s.pots.find((p) => p.id === fromId);
  const to = s.pots.find((p) => p.id === toId);
  if (!from || !to) return { ok: false, message: "Pick both pots." };
  if (!canLend(from, to)) {
    return { ok: false, message: from.layer === 0 ? "A section can only lend to another section." : `${label(s, from.id)} can only lend to the layer just below it.` };
  }
  amount = r2(amount);
  if (!(amount >= 0.01)) return { ok: false, message: "Enter an amount." };
  if (amount > from.balance) return { ok: false, message: `${label(s, from.id)} only has ${money(from.balance)} to lend.` };
  if (owedBy(s, to.id) > 0) return { ok: false, message: `${label(s, to.id)} must pay back its current loan before borrowing again.` };
  if (to.noBorrowUntil && to.noBorrowUntil > Date.now()) {
    const min = Math.ceil((to.noBorrowUntil - Date.now()) / 60_000);
    return { ok: false, message: `${label(s, to.id)} ran out just now. Take a break: it can borrow again in ${min} min.` };
  }
  const now = Date.now();
  from.balance = r2(from.balance - amount);
  to.balance = r2(to.balance + amount);
  s.loans.push({ id: `L${s.nextLoanId++}`, from: from.id, to: to.id, amount, owed: amount, createdAt: now, dueAt: now + s.settings.loanHours * 3_600_000 });
  log(s, `${label(s, from.id)} lent ${money(amount)} to ${label(s, to.id)}, due in ${s.settings.loanHours}h.`);
  changed(userId, type);
  return { ok: true };
}

function pay(s: State, loan: Loan, amount: number, how: string): number {
  const borrower = s.pots.find((p) => p.id === loan.to);
  const lender = s.pots.find((p) => p.id === loan.from);
  if (!borrower || !lender) return 0;
  const paid = r2(Math.min(amount, loan.owed, borrower.balance));
  if (paid <= 0) return 0;
  borrower.balance = r2(borrower.balance - paid);
  lender.balance = r2(lender.balance + paid);
  loan.owed = r2(loan.owed - paid);
  log(s, `${label(s, loan.to)} ${how} ${money(paid)} to ${label(s, loan.from)}${loan.owed > 0 ? ` (still owes ${money(loan.owed)})` : " (loan cleared)"}.`);
  if (loan.owed <= 0) s.loans = s.loans.filter((l) => l !== loan);
  return paid;
}

export async function repay(userId: string, type: AccountType, loanId: string, amount?: number): Promise<Result> {
  const s = await ensureLoaded(userId, type);
  const loan = s?.loans.find((l) => l.id === loanId);
  if (!s || !loan) return { ok: false, message: "Loan not found." };
  const borrower = s.pots.find((p) => p.id === loan.to);
  if (!borrower || borrower.balance <= 0) return { ok: false, message: `${label(s, loan.to)} has no money to pay with right now.` };
  pay(s, loan, amount === undefined ? loan.owed : r2(amount), "paid back");
  changed(userId, type);
  return { ok: true };
}

/** Collects every loan that is due, from whatever the borrower has. True if anything moved. */
function collectDue(s: State, now: number): boolean {
  let moved = false;
  for (const loan of [...s.loans]) if (loan.dueAt <= now && pay(s, loan, loan.owed, "was charged") > 0) moved = true;
  return moved;
}

// ---------- Deriv balance check ----------

/**
 * Called with the live Deriv balance: turns the strategy OFF when the account holds less than the
 * pots say (money lost in normal trades, on deriv.com, or withdrawn), so it can't run underfunded.
 */
export function checkDerivBalance(type: AccountType, derivBalance: number): void {
  for (const [key, s] of states) {
    if (!s || !s.active || !key.startsWith(`${type}:`)) continue;
    const userId = key.slice(type.length + 1);
    const need = held(s);
    if (derivBalance + 0.005 < need) {
      s.active = false;
      s.offReason = {
        kind: "balance",
        text: `your ${type} balance (${money(derivBalance)}) is below what the pots need (${money(need)}). Adjust the pots to your balance to turn it back on.`,
      };
      log(s, `Turned off: balance ${money(derivBalance)} is below the pots' ${money(need)}.`);
      console.warn(`[split] turned off for ${key}: balance ${derivBalance} < pots ${need}`);
      changed(userId, type);
    }
  }
}

/** Shrinks the pots to fit the Deriv balance (top bank first) and turns the strategy back on. */
export async function adjustToBalance(userId: string, type: AccountType, derivBalance: number | null): Promise<Result> {
  const s = await ensureLoaded(userId, type);
  if (!s) return { ok: false, message: "Set up your pots first." };
  if (derivBalance === null) return { ok: false, message: "Your balance isn't known yet. Try again in a moment." };
  let missing = r2(held(s) - derivBalance);
  if (missing > 0) {
    const order = [...s.pots].sort((a, b) => b.layer - a.layer || Number(b.id.slice(1)) - Number(a.id.slice(1)));
    for (const p of order) {
      if (missing <= 0) break;
      const take = Math.min(p.balance, missing);
      p.balance = r2(p.balance - take);
      missing = r2(missing - take);
    }
    log(s, `Pots adjusted down to match the balance of ${money(derivBalance)}.`);
  }
  s.offReason = null;
  s.active = true;
  log(s, "Turned back on.");
  changed(userId, type);
  return { ok: true };
}

// ---------- Background work: due loans, saving, restarts ----------

let restored = false;
let restoreHandler: ((userId: string, type: AccountType, trades: OpenTrade[]) => void) | null = null;

/** The trading module re-follows open strategy trades after a restart through this. */
export function onRestoreOpenTrades(handler: (userId: string, type: AccountType, trades: OpenTrade[]) => void): void {
  restoreHandler = handler;
}

async function tick(): Promise<void> {
  // After a restart: load every saved strategy (once the database is up), so loans keep being
  // collected and trades that were running get their results
  if (!restored && store.dbReady()) {
    try {
      for (const row of await store.loadAllStates<State>()) {
        const key = keyOf(row.userId, row.account);
        if (!states.has(key)) states.set(key, upgrade(row.data));
        const s = states.get(key);
        // A buy that never got its contract id was interrupted: give the stake back
        if (s) for (const o of s.open.filter((x) => x.contractId === 0)) releasePotTrade(row.userId, row.account, o.potId);
        const open = openTradesOf(row.userId, row.account);
        if (open.length && restoreHandler) restoreHandler(row.userId, row.account, open);
      }
      restored = true;
    } catch (err) {
      console.error("[split] could not load strategies yet:", (err as Error).message);
    }
  }
  const now = Date.now();
  for (const [key, s] of states) {
    if (!s) continue;
    const type = key.slice(0, key.indexOf(":")) as AccountType;
    const userId = key.slice(key.indexOf(":") + 1);
    if (collectDue(s, now)) changed(userId, type);
  }
  if (dirty.size) saveSoon();
}

setInterval(() => void tick(), TICK_MS).unref();
setTimeout(() => void tick(), 5_000).unref();

/** For tests: save to `testStore` instead of MongoDB, and forget everything in memory. */
export function _useStoreForTests(testStore: typeof store): void {
  store = testStore;
  states.clear();
  dirty.clear();
}

/** For tests: run the every-minute work now. */
export const _tickForTests = () => tick();
