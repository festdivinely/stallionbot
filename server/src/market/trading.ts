// Placing and following trades on the user's chosen Deriv account: "demo" (virtual money, the
// default) or "real" (real money, only when the user has picked Real in the app).
//  - placeTrade():  risk check (server/src/risk) -> Deriv `buy` -> follow the contract live.
//                   This is the ONLY code that sends `buy`; nothing may skip the risk check.
//  - sellTrade():   close an open contract early at the market price (Deriv `sell`).
//  - getTrades():   a user's open and recent contracts on one account, plus its balance.
//  - getAccountsSummary(): both accounts and their balances, for the Demo/Real switch.
// Contracts are followed with proposal_open_contract subscriptions on the socket of the account
// they were bought on; when one settles, its profit/loss is reported to the risk module.

import type { DerivMessage } from "../deriv/socket.js";
import type { AccountType } from "../deriv/rest.js";
import { accountFor, followBalance, getSharedSocket, liveBalance, onBalanceChange, request, setBalance } from "../deriv/shared.js";
import { cancelPending, checkTrade, recordBuy, recordSettled, riskSummary } from "../risk/index.js";
import {
  checkDerivBalance,
  confirmPotTrade,
  ensureLoaded,
  onPotsChange,
  onRestoreOpenTrades,
  releasePotTrade,
  reservePotTrade,
  settlePotTrade,
  summaryOf,
} from "../risk/splitMoney.js";
import type { QuoteParams } from "./catalog.js";

const RECENT_PER_USER = 20; // finished trades kept per user and account

export interface TradeRecord {
  contractId: number;
  userId: string;
  accountType: AccountType;
  symbol: string;
  contractType: string;
  longcode: string;
  buyPrice: number;
  payout: number;
  purchaseTime: number;
  status: "open" | "won" | "lost" | "sold" | "cancelled";
  profit: number;
  currentSpot?: number;
  entrySpot?: number;
  exitSpot?: number;
  dateExpiry?: number;
  tickCount?: number;
  ticksPassed?: number;
  canSell: boolean;
  bidPrice?: number;
  sellPrice?: number;
  barrier?: number;
  highBarrier?: number;
  lowBarrier?: number;
  dateStart?: number;
  entrySpotTime?: number;
  exitSpotTime?: number;
  /** Decimals Deriv quotes the price with (from its own text), for showing prices exactly */
  decimals?: number;
  /** Every price during the contract, oldest first: epoch seconds + price. For the live chart. */
  /** `s` = the price exactly as Deriv shows it (for the true last digit), when Deriv sends it */
  path: { t: number; q: number; s?: string }[];
  /** Reset Call/Put: when the reset check happens, and the barrier after it (if it moved) */
  resetTime?: number;
  resetBarrier?: number;
  /** High/Low Ticks: which tick (1-5) the trader picked, and its price once it has happened */
  selectedTick?: number;
  selectedSpot?: number;
  /** Split Money strategy: the pot this trade's stake came from */
  potId?: string;
  subscriptionId?: string;
}

const MAX_PATH = 600; // long contracts: keep the chart light
const FOLLOW_BACKUP_MS = 1500;

/** Deriv sends prices and barriers as text ("4962.12"); numbers otherwise. */
const toNum = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};
const decimalsOf = (v: unknown) => (typeof v === "string" && v.includes(".") ? v.split(".")[1]!.length : undefined);

/** Adds a price to the contract's path (in time order, no duplicates), thinning very long paths. */
function addPoint(t: TradeRecord, time: number | undefined, price: number | undefined) {
  if (time === undefined || price === undefined) return;
  const last = t.path[t.path.length - 1];
  if (last && time <= last.t) return;
  t.path.push({ t: time, q: price });
  if (t.path.length > MAX_PATH) t.path = t.path.filter((_, i) => i % 2 === 0 || i === t.path.length - 1);
}

// Contract ids are unique per account, so the key includes the account type
const trades = new Map<string, TradeRecord>();
const keyOf = (type: AccountType, contractId: number) => `${type}:${contractId}`;
const started = new Set<AccountType>();

// Field types as in Deriv's schema: spots, barriers and sell price arrive as text
interface OpenContractMessage extends DerivMessage {
  proposal_open_contract: {
    contract_id: number;
    status?: string | null;
    is_sold?: number;
    profit?: number | string;
    current_spot?: string | number;
    current_spot_time?: number;
    entry_spot?: string | number | null;
    entry_spot_time?: number | null;
    exit_spot?: string | number | null;
    exit_spot_time?: number | null;
    barrier?: string | number | null;
    high_barrier?: string | number;
    low_barrier?: string | number;
    date_start?: number;
    date_expiry?: number;
    tick_count?: number;
    tick_passed?: number;
    tick_stream?: { epoch: number; tick: number | null; tick_display_value?: string | null }[];
    is_valid_to_sell?: number;
    bid_price?: number | string;
    sell_price?: string | number | null;
    reset_time?: number | null;
    reset_barrier?: string | number | null;
    selected_tick?: number | null;
    selected_spot?: string | number | null;
    // Also in every update; used to fill in trades picked up again after a restart
    contract_type?: string;
    underlying_symbol?: string;
    buy_price?: number | string;
    payout?: number | string;
    longcode?: string;
    purchase_time?: number;
  };
  subscription?: { id: string };
}

// ---- Telling the app about changes the moment they happen ("long polling") ----
// The app asks "anything newer than version N?" and the server holds that request open until a
// trade of that user changes (a tick, the result, a new buy), then answers at once. So every tick
// reaches the phone right away instead of waiting for the app's next poll.
const versions = new Map<string, number>();
const waiters = new Map<string, Set<() => void>>();
const userKey = (userId: string, type: AccountType) => `${type}:${userId}`;

export const tradesVersion = (userId: string, type: AccountType) => versions.get(userKey(userId, type)) ?? 0;

function notify(userId: string, type: AccountType): void {
  const key = userKey(userId, type);
  versions.set(key, tradesVersion(userId, type) + 1);
  const waiting = waiters.get(key);
  if (!waiting) return;
  waiters.delete(key);
  for (const wake of waiting) wake();
}

// A new balance (e.g. a win paid out) wakes everyone watching that account
onBalanceChange((type) => {
  for (const key of new Set([...waiters.keys(), ...versions.keys()])) {
    if (key.startsWith(`${type}:`)) notify(key.slice(type.length + 1), type);
  }
  // Split Money: pause any strategy whose pots now hold more than the account really has
  const b = liveBalance(type);
  if (b) checkDerivBalance(type, b.balance);
});

// Split Money: pot balances changed (a trade settled, a loan was collected...): wake the app
onPotsChange((userId, type) => notify(userId, type));

// Split Money after a server restart: follow the strategy's trades that were still running, so
// their results still go back into their pots
onRestoreOpenTrades((userId, type, open) => {
  start(type);
  for (const o of open) {
    const key = keyOf(type, o.contractId);
    if (trades.has(key)) continue;
    trades.set(key, {
      contractId: o.contractId,
      userId,
      accountType: type,
      symbol: o.symbol ?? "",
      contractType: o.contractType ?? "",
      longcode: "",
      buyPrice: o.stake,
      payout: 0,
      purchaseTime: Math.floor(Date.now() / 1000),
      status: "open",
      profit: 0,
      canSell: false,
      path: [],
      potId: o.potId,
    });
    follow(type, o.contractId);
  }
});

/** Resolves when this user's trades change after `since`, or after `timeoutMs` (whichever is first). */
export function waitForTrades(userId: string, type: AccountType, since: number, timeoutMs: number, signal: AbortSignal): Promise<void> {
  if (tradesVersion(userId, type) > since) return Promise.resolve();
  return new Promise((resolve) => {
    const key = userKey(userId, type);
    const done = () => {
      clearTimeout(timer);
      waiters.get(key)?.delete(done);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    signal.addEventListener("abort", done, { once: true });
    if (!waiters.has(key)) waiters.set(key, new Set());
    waiters.get(key)!.add(done);
  });
}

function follow(type: AccountType, contractId: number): void {
  try {
    getSharedSocket(type).send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });
  } catch {
    // Socket down: onOpen re-subscribes every open trade after reconnecting
  }
}

/** Listens for contract updates on this account's socket (once). */
function start(type: AccountType): void {
  if (started.has(type)) return;
  started.add(type);
  const s = getSharedSocket(type);
  // After a reconnect the subscriptions are gone: follow every open trade again
  s.onOpen(() => {
    for (const t of trades.values()) if (t.accountType === type && t.status === "open") follow(type, t.contractId);
  });
  s.onMessage((msg) => {
    if (msg.msg_type !== "proposal_open_contract" || msg.error) return;
    const { proposal_open_contract: c, subscription } = msg as OpenContractMessage;
    const t = trades.get(keyOf(type, c.contract_id));
    if (!t) return;
    if (subscription?.id) t.subscriptionId = subscription.id;
    const set = <K extends keyof TradeRecord>(key: K, value: TradeRecord[K] | undefined) => {
      if (value !== undefined) t[key] = value;
    };
    // A trade picked up again after a restart starts with blanks: fill them from Deriv
    if (!t.contractType && c.contract_type) t.contractType = c.contract_type;
    if (!t.symbol && c.underlying_symbol) t.symbol = c.underlying_symbol;
    if (!t.longcode && c.longcode) t.longcode = c.longcode;
    if (!t.payout) set("payout", toNum(c.payout));
    if (c.purchase_time && !t.path.length) t.purchaseTime = c.purchase_time;
    set("profit", toNum(c.profit));
    set("currentSpot", toNum(c.current_spot));
    set("entrySpot", toNum(c.entry_spot));
    set("exitSpot", toNum(c.exit_spot));
    set("entrySpotTime", c.entry_spot_time ?? undefined);
    set("exitSpotTime", c.exit_spot_time ?? undefined);
    set("barrier", toNum(c.barrier));
    set("highBarrier", toNum(c.high_barrier));
    set("lowBarrier", toNum(c.low_barrier));
    set("dateStart", c.date_start);
    set("dateExpiry", c.date_expiry);
    set("tickCount", c.tick_count);
    set("ticksPassed", c.tick_passed);
    set("bidPrice", toNum(c.bid_price));
    set("sellPrice", toNum(c.sell_price));
    set("resetTime", c.reset_time ?? undefined);
    set("resetBarrier", toNum(c.reset_barrier));
    set("selectedTick", c.selected_tick ?? undefined);
    set("selectedSpot", toNum(c.selected_spot));
    set("decimals", decimalsOf(c.current_spot) ?? decimalsOf(c.entry_spot) ?? t.decimals);
    t.canSell = c.is_valid_to_sell === 1;

    // The price path for the chart. Tick contracts come with the whole tick stream; others get one
    // update per price change, starting at the entry spot.
    if (c.tick_stream?.length) {
      t.path = c.tick_stream
        .filter((s) => typeof s.tick === "number")
        .map((s) => ({ t: s.epoch, q: s.tick as number, ...(s.tick_display_value ? { s: s.tick_display_value } : {}) }));
    } else {
      if (!t.path.length) addPoint(t, t.entrySpotTime, t.entrySpot);
      addPoint(t, c.current_spot_time, toNum(c.current_spot));
    }
    if (c.is_sold === 1) addPoint(t, t.exitSpotTime, t.exitSpot);

    if (c.is_sold === 1 && t.status === "open") {
      t.status = c.status === "won" || c.status === "lost" || c.status === "cancelled" ? c.status : "sold";
      t.canSell = false;
      recordSettled(t.userId, type, t.contractId, t.profit);
      settlePotTrade(t.userId, type, t.contractId, t.profit);
      if (t.subscriptionId) {
        try {
          getSharedSocket(type).send({ forget: t.subscriptionId });
        } catch {
          // Socket down: the subscription is gone anyway
        }
      }
      prune(t.userId, type);
    }
    notify(t.userId, type);
  });
}

/** Keep only the most recent finished trades per user and account. */
function prune(userId: string, type: AccountType): void {
  const finished = [...trades.values()]
    .filter((t) => t.userId === userId && t.accountType === type && t.status !== "open")
    .sort((a, b) => b.purchaseTime - a.purchaseTime);
  for (const t of finished.slice(RECENT_PER_USER)) trades.delete(keyOf(type, t.contractId));
}

export type TradeResult = { ok: true; trade: ReturnType<typeof publicView> } | { ok: false; message: string };

/** Risk check, then buy on the chosen account. */
export async function placeTrade(userId: string, p: QuoteParams, type: AccountType, potId?: string): Promise<TradeResult> {
  const startedAt = Date.now();
  const account = await accountFor(type).catch(() => null); // remembered list: no web request
  if (!account) {
    return {
      ok: false,
      message: type === "real" ? "No real Deriv account is connected yet. Open one on Deriv, then try again." : "The demo account is not available right now.",
    };
  }
  // The Split Money pots (already in memory after the first load, so normally no wait here)
  try {
    await ensureLoaded(userId, type);
  } catch {
    return { ok: false, message: "Could not check your Split Money pots right now. Nothing was bought; try again." };
  }
  start(type);
  const risk = checkTrade(userId, type, p.amount);
  if (!risk.ok) return { ok: false, message: risk.reason };
  // Split Money: the stake must fit in the chosen pot (taken out of it now, given back if the buy fails)
  const pot = reservePotTrade(userId, type, potId, p.amount);
  if (!pot.ok) {
    cancelPending(userId, type);
    return { ok: false, message: pot.message };
  }

  try {
    const parameters: Record<string, unknown> = {
      contract_type: p.contractType,
      underlying_symbol: p.symbol,
      currency: account.currency,
      amount: p.amount,
      basis: "stake",
    };
    if (p.dateExpiry !== undefined) {
      parameters.date_expiry = p.dateExpiry;
    } else if (p.duration !== undefined) {
      parameters.duration = p.duration;
      parameters.duration_unit = p.durationUnit ?? "t";
    }
    if (p.barrier !== undefined) parameters.barrier = p.barrier;
    if (p.barrier2 !== undefined) parameters.barrier2 = p.barrier2;
    if (p.multiplier !== undefined) parameters.multiplier = p.multiplier;
    if (p.growthRate !== undefined) parameters.growth_rate = p.growthRate;
    if (p.cancellation !== undefined) parameters.cancellation = p.cancellation;
    if (p.payoutPerPoint !== undefined) parameters.payout_per_point = p.payoutPerPoint;
    if (p.selectedTick !== undefined) parameters.selected_tick = p.selectedTick;

    // price = the most we agree to pay; with basis "stake" that is the stake itself
    const sentAt = Date.now();
    // subscribe: 1 makes Deriv stream this contract's updates straight after the buy, with no
    // separate "follow this contract" request (saves a round trip before the first tick shows)
    const msg = await request({ buy: 1, price: p.amount, parameters, subscribe: 1 }, type);
    const derivMs = Date.now() - sentAt;
    if (msg.error) {
      cancelPending(userId, type);
      releasePotTrade(userId, type, potId);
      return { ok: false, message: msg.error.message };
    }
    const b = msg.buy as { contract_id: number; longcode: string; buy_price: number; payout: number; purchase_time: number; balance_after?: number | string };
    recordBuy(userId, type, b.contract_id, b.buy_price);
    confirmPotTrade(userId, type, potId, b.contract_id, b.buy_price, { symbol: p.symbol, contractType: p.contractType });
    if (b.balance_after !== undefined) setBalance(type, Number(b.balance_after), account.currency);
    const trade: TradeRecord = {
      contractId: b.contract_id,
      userId,
      accountType: type,
      symbol: p.symbol,
      contractType: p.contractType,
      longcode: b.longcode,
      buyPrice: b.buy_price,
      payout: b.payout,
      purchaseTime: b.purchase_time,
      status: "open",
      profit: 0,
      canSell: false,
      path: [],
      // Known from the order itself, before Deriv's first update arrives
      ...(p.selectedTick !== undefined ? { selectedTick: p.selectedTick } : {}),
      ...(p.contractType.startsWith("DIGIT") && p.barrier !== undefined ? { barrier: Number(p.barrier) } : {}),
      ...(potId ? { potId } : {}),
    };
    trades.set(keyOf(type, trade.contractId), trade);
    notify(userId, type);
    // Backup: if the buy's own stream sends nothing, follow the contract the usual way
    setTimeout(() => {
      if (!trade.subscriptionId && trade.status === "open") follow(type, trade.contractId);
    }, FOLLOW_BACKUP_MS);
    console.info("[trade] bought", {
      userId,
      account: type,
      contractId: trade.contractId,
      symbol: p.symbol,
      contractType: p.contractType,
      stake: b.buy_price,
      // How long the buy took on our side vs. waiting for Deriv
      ms: { total: Date.now() - startedAt, deriv: derivMs },
    });
    return { ok: true, trade: publicView(trade) };
  } catch (err) {
    cancelPending(userId, type);
    releasePotTrade(userId, type, potId);
    console.error("[trade] buy failed:", (err as Error).message);
    return { ok: false, message: "Could not reach Deriv to place the trade. Nothing was bought." };
  }
}

/** Sell an open trade now at the market price. Only the user who bought it may sell it. */
export async function sellTrade(userId: string, type: AccountType, contractId: number): Promise<{ ok: boolean; message?: string; soldFor?: number }> {
  const t = trades.get(keyOf(type, contractId));
  if (!t || t.userId !== userId) return { ok: false, message: "Trade not found." };
  if (t.status !== "open") return { ok: false, message: "This trade has already finished." };
  const msg = await request({ sell: contractId, price: 0 }, type);
  if (msg.error) return { ok: false, message: msg.error.message };
  const sold = msg.sell as { sold_for?: number };
  // The settled result arrives through the contract's proposal_open_contract updates
  return { ok: true, soldFor: sold.sold_for };
}

const publicView = ({ userId: _u, subscriptionId: _s, ...rest }: TradeRecord) => rest;

/** The live balance Deriv pushes; until the first push arrives, the one from the account list. */
function balanceOf(type: AccountType, a: { balance: string; currency: string } | null) {
  if (!a) return null;
  followBalance(type);
  return liveBalance(type) ?? { balance: Number(a.balance), currency: a.currency };
}

/** What the app shows for one account: its balance, open trades, recent trades, risk standing. */
export async function getTrades(userId: string, type: AccountType) {
  const account = await accountFor(type).catch(() => null);
  if (account) start(type);
  // Split Money pots: loaded here so they are ready before the first buy
  await ensureLoaded(userId, type).catch(() => null);
  const mine = [...trades.values()]
    .filter((t) => t.userId === userId && t.accountType === type)
    .sort((a, b) => b.purchaseTime - a.purchaseTime);
  const balance = balanceOf(type, account);
  if (balance) checkDerivBalance(type, balance.balance);
  return {
    account: type,
    available: !!account,
    balance,
    open: mine.filter((t) => t.status === "open").map(publicView),
    recent: mine.filter((t) => t.status !== "open").map(publicView),
    risk: riskSummary(userId, type),
    // Split Money pots when the strategy is on (null otherwise)
    strategy: summaryOf(userId, type),
  };
}

/** This account's balance now (null when the account isn't available). */
export async function balanceFor(type: AccountType): Promise<number | null> {
  const account = await accountFor(type).catch(() => null);
  return balanceOf(type, account)?.balance ?? null;
}

/** Both accounts and their balances, for the Demo/Real switch. */
export async function getAccountsSummary() {
  const [demo, real] = await Promise.all([accountFor("demo").catch(() => null), accountFor("real").catch(() => null)]);
  return {
    demo: { available: !!demo, balance: balanceOf("demo", demo) },
    real: { available: !!real, balance: balanceOf("real", real) },
  };
}
