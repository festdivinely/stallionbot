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
import { accountFor, followBalance, getSharedSocket, liveBalance, request, setBalance } from "../deriv/shared.js";
import { cancelPending, checkTrade, recordBuy, recordSettled, riskSummary } from "../risk/index.js";
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
  path: { t: number; q: number }[];
  subscriptionId?: string;
}

const MAX_PATH = 600; // long contracts: keep the chart light

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
  };
  subscription?: { id: string };
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
    set("decimals", decimalsOf(c.current_spot) ?? decimalsOf(c.entry_spot) ?? t.decimals);
    t.canSell = c.is_valid_to_sell === 1;

    // The price path for the chart. Tick contracts come with the whole tick stream; others get one
    // update per price change, starting at the entry spot.
    if (c.tick_stream?.length) {
      t.path = c.tick_stream.filter((s) => typeof s.tick === "number").map((s) => ({ t: s.epoch, q: s.tick as number }));
    } else {
      if (!t.path.length) addPoint(t, t.entrySpotTime, t.entrySpot);
      addPoint(t, c.current_spot_time, toNum(c.current_spot));
    }
    if (c.is_sold === 1) addPoint(t, t.exitSpotTime, t.exitSpot);

    if (c.is_sold === 1 && t.status === "open") {
      t.status = c.status === "won" || c.status === "lost" || c.status === "cancelled" ? c.status : "sold";
      t.canSell = false;
      recordSettled(t.userId, type, t.contractId, t.profit);
      if (t.subscriptionId) {
        try {
          getSharedSocket(type).send({ forget: t.subscriptionId });
        } catch {
          // Socket down: the subscription is gone anyway
        }
      }
      prune(t.userId, type);
    }
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
export async function placeTrade(userId: string, p: QuoteParams, type: AccountType): Promise<TradeResult> {
  const startedAt = Date.now();
  const account = await accountFor(type).catch(() => null); // remembered list: no web request
  if (!account) {
    return {
      ok: false,
      message: type === "real" ? "No real Deriv account is connected yet. Open one on Deriv, then try again." : "The demo account is not available right now.",
    };
  }
  start(type);
  const risk = checkTrade(userId, type, p.amount);
  if (!risk.ok) return { ok: false, message: risk.reason };

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
    const msg = await request({ buy: 1, price: p.amount, parameters }, type);
    const derivMs = Date.now() - sentAt;
    if (msg.error) {
      cancelPending(userId, type);
      return { ok: false, message: msg.error.message };
    }
    const b = msg.buy as { contract_id: number; longcode: string; buy_price: number; payout: number; purchase_time: number; balance_after?: number | string };
    recordBuy(userId, type, b.contract_id, b.buy_price);
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
    };
    trades.set(keyOf(type, trade.contractId), trade);
    follow(type, trade.contractId);
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
  const mine = [...trades.values()]
    .filter((t) => t.userId === userId && t.accountType === type)
    .sort((a, b) => b.purchaseTime - a.purchaseTime);
  return {
    account: type,
    available: !!account,
    balance: balanceOf(type, account),
    open: mine.filter((t) => t.status === "open").map(publicView),
    recent: mine.filter((t) => t.status !== "open").map(publicView),
    risk: riskSummary(userId, type),
  };
}

/** Both accounts and their balances, for the Demo/Real switch. */
export async function getAccountsSummary() {
  const [demo, real] = await Promise.all([accountFor("demo").catch(() => null), accountFor("real").catch(() => null)]);
  return {
    demo: { available: !!demo, balance: balanceOf("demo", demo) },
    real: { available: !!real, balance: balanceOf("real", real) },
  };
}
