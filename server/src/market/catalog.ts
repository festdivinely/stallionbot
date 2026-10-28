// What can be traded in the Deriv options market, straight from Deriv (never a hand-written list):
//  - getAssets():          every active symbol (active_symbols), grouped like Deriv SmartTrader:
//                          category tab (Forex, Stock Indices...) -> group (Major Pairs...) -> asset
//  - getTradeTypes(symbol): the trade types Deriv offers for ONE asset (contracts_for), with the
//                          settings each allows: durations, barriers, digits, multipliers...
//  - getQuote(params):     asks Deriv to price a trade (proposal). Deriv checks every setting and
//                          either returns the payout or says what is wrong. Nothing is bought.

import { getAccountCurrency, request } from "../deriv/shared.js";

const ASSETS_TTL_MS = 5 * 60_000; // open/closed changes during the day
const TRADE_TYPES_TTL_MS = 5 * 60_000; // default barriers follow the price

// ---------- Assets ----------

interface ActiveSymbol {
  exchange_is_open: number;
  is_trading_suspended: number;
  market: string;
  pip_size: number;
  subgroup: string;
  submarket: string;
  underlying_symbol: string;
  underlying_symbol_name: string;
}

export interface Asset {
  symbol: string;
  name: string;
  pipSize: number;
  /** Market open right now (forex/stocks close at weekends; synthetics never close). */
  open: boolean;
  suspended: boolean;
}

export interface AssetGroup {
  id: string;
  label: string;
  assets: Asset[];
}

export interface AssetCategory {
  id: string;
  label: string;
  groups: AssetGroup[];
}

// Category tabs, in SmartTrader's order. Deriv's synthetic_index market is split by subgroup.
const CATEGORIES: { id: string; label: string; match: (s: ActiveSymbol) => boolean }[] = [
  { id: "forex", label: "Forex", match: (s) => s.market === "forex" },
  { id: "indices", label: "Stock Indices", match: (s) => s.market === "indices" },
  { id: "commodities", label: "Commodities", match: (s) => s.market === "commodities" },
  { id: "cryptocurrency", label: "Cryptocurrencies", match: (s) => s.market === "cryptocurrency" },
  { id: "baskets", label: "Derived (Baskets)", match: (s) => s.market === "synthetic_index" && s.subgroup === "baskets" },
  { id: "synthetics", label: "Derived (Synthetics)", match: (s) => s.market === "synthetic_index" && s.subgroup !== "baskets" },
];

// Deriv sends submarket ids only; these are the names SmartTrader shows. Order = display order.
const GROUP_LABELS: Record<string, string> = {
  major_pairs: "Major Pairs",
  minor_pairs: "Minor Pairs",
  asia_oceania_OTC: "Asian indices",
  europe_OTC: "European indices",
  americas_OTC: "American indices",
  metals: "Metals",
  energy: "Energy",
  non_stable_coin: "Cryptocurrencies",
  forex_basket: "Forex Basket",
  commodity_basket: "Commodities Basket",
  random_index: "Continuous Indices",
  crash_index: "Crash/Boom Indices",
  random_daily: "Daily Reset Indices",
  jump_index: "Jump Indices",
  range_index: "Range Break Indices",
  step_index: "Step Indices",
};

const titleCase = (id: string) => id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// "Volatility 10 (1s) Index" before "Volatility 100 (1s) Index": compare numbers as numbers
const byName = (a: Asset, b: Asset) => a.name.localeCompare(b.name, "en", { numeric: true });

let assetsCache: { at: number; data: AssetCategory[] } | undefined;
let assetsLoading: Promise<AssetCategory[]> | undefined;

export async function getAssets(): Promise<AssetCategory[]> {
  if (assetsCache && Date.now() - assetsCache.at < ASSETS_TTL_MS) return assetsCache.data;
  assetsLoading ??= (async () => {
    const msg = await request({ active_symbols: "brief" });
    if (msg.error) throw new Error(`active_symbols: ${msg.error.message}`);
    const symbols = msg.active_symbols as ActiveSymbol[];

    const groupOrder = Object.keys(GROUP_LABELS);
    const rank = (id: string) => (groupOrder.includes(id) ? groupOrder.indexOf(id) : groupOrder.length);

    const data = CATEGORIES.map(({ id, label, match }) => {
      const groups = new Map<string, Asset[]>();
      for (const s of symbols.filter(match)) {
        const list = groups.get(s.submarket) ?? [];
        list.push({
          symbol: s.underlying_symbol,
          name: s.underlying_symbol_name,
          pipSize: s.pip_size,
          open: s.exchange_is_open === 1,
          suspended: s.is_trading_suspended === 1,
        });
        groups.set(s.submarket, list);
      }
      return {
        id,
        label,
        groups: [...groups.entries()]
          .sort(([a], [b]) => rank(a) - rank(b))
          .map(([gid, assets]) => ({ id: gid, label: GROUP_LABELS[gid] ?? titleCase(gid), assets: assets.sort(byName) })),
      };
    }).filter((c) => c.groups.length > 0);

    assetsCache = { at: Date.now(), data };
    return data;
  })().finally(() => {
    assetsLoading = undefined;
  });
  return assetsLoading;
}

/** symbol -> display name, from the cached asset list (empty until it has loaded once). */
export function assetNames(): Record<string, string> {
  const names: Record<string, string> = {};
  for (const c of assetsCache?.data ?? []) for (const g of c.groups) for (const a of g.assets) names[a.symbol] = a.name;
  return names;
}

// ---------- Trade types ----------

interface AvailableContract {
  barriers: number;
  barrier?: string | null;
  high_barrier?: string | null;
  low_barrier?: string | null;
  barrier_choices?: string[];
  contract_category: string;
  contract_type: string;
  expiry_type: string;
  max_contract_duration: string;
  min_contract_duration: string;
  sentiment: string;
  default_stake?: number;
  last_digit_range?: number[];
  multiplier_range?: number[];
  growth_rate_range?: number[];
  cancellation_range?: string[];
  payout_choices?: number[];
  min_stake?: number | null;
  max_stake?: number | null;
}

/** One way to trade, e.g. "Rise/Fall": the two (or one) buttons and what each buys. */
interface TradeTypeDef {
  id: string;
  label: string;
  /** contract_type -> button label, in button order */
  sides: Record<string, string>;
  /**
   * Barrier boxes the trader fills in. Deriv lists a barrier for some types where it is fixed
   * (Rise/Fall, Reset, Only Ups/Downs use the entry price), so we don't go by Deriv's count.
   * Turbos and Vanillas pick from `barrierChoices` instead.
   */
  barrierInputs?: 1 | 2;
}

// The trade types SmartTrader shows, and the Deriv contract types behind each one.
// (The "...E" contract types - CALLE, PUTE, EXPIRYRANGEE, EXPIRYMISSE - are the "allow equals"
// versions; they are attached to their trade type below as `equalsSides`.)
const TRADE_TYPES: TradeTypeDef[] = [
  { id: "rise_fall", label: "Rise/Fall", sides: { CALL: "Rise", PUT: "Fall" } },
  { id: "higher_lower", label: "Higher/Lower", sides: { HIGHER: "Higher", LOWER: "Lower" }, barrierInputs: 1 },
  { id: "touch_no_touch", label: "Touch/No Touch", sides: { ONETOUCH: "Touch", NOTOUCH: "No Touch" }, barrierInputs: 1 },
  { id: "ends_between", label: "Ends Between/Ends Outside", sides: { EXPIRYRANGE: "Ends Between", EXPIRYMISS: "Ends Outside" }, barrierInputs: 2 },
  { id: "stays_between", label: "Stays Between/Goes Outside", sides: { RANGE: "Stays Between", UPORDOWN: "Goes Outside" }, barrierInputs: 2 },
  { id: "matches_differs", label: "Matches/Differs", sides: { DIGITMATCH: "Matches", DIGITDIFF: "Differs" } },
  { id: "even_odd", label: "Even/Odd", sides: { DIGITEVEN: "Even", DIGITODD: "Odd" } },
  { id: "over_under", label: "Over/Under", sides: { DIGITOVER: "Over", DIGITUNDER: "Under" } },
  { id: "accumulators", label: "Accumulators", sides: { ACCU: "Buy" } },
  { id: "multipliers", label: "Multipliers", sides: { MULTUP: "Up", MULTDOWN: "Down" } },
  { id: "turbos", label: "Turbos", sides: { TURBOSLONG: "Up", TURBOSSHORT: "Down" } },
  { id: "vanillas", label: "Vanillas", sides: { VANILLALONGCALL: "Call", VANILLALONGPUT: "Put" } },
  { id: "asians", label: "Asians", sides: { ASIANU: "Asian Rise", ASIAND: "Asian Fall" } },
  { id: "reset", label: "Reset Call/Reset Put", sides: { RESETCALL: "Reset Call", RESETPUT: "Reset Put" } },
  { id: "high_low_ticks", label: "High/Low Ticks", sides: { TICKHIGH: "High Tick", TICKLOW: "Low Tick" } },
  { id: "only_ups_downs", label: "Only Ups/Only Downs", sides: { RUNHIGH: "Only Ups", RUNLOW: "Only Downs" } },
];

const EQUALS_VERSION: Record<string, string> = { CALL: "CALLE", PUT: "PUTE", EXPIRYRANGE: "EXPIRYRANGEE", EXPIRYMISS: "EXPIRYMISSE" };

type DurationUnit = "t" | "s" | "m" | "h" | "d";

/** "15s" -> 15 seconds, "10t" -> 10 ticks, "365d" -> 365 days. */
function parseDuration(text: string): { value: number; unit: DurationUnit } | null {
  const m = /^(\d+)([tsmhd])$/.exec(text);
  return m ? { value: Number(m[1]), unit: m[2] as DurationUnit } : null;
}

const SECONDS: Record<Exclude<DurationUnit, "t">, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** How long a contract may run, per unit the user can pick, e.g. ticks 1-10, minutes 1-1440. */
export interface DurationOption {
  unit: DurationUnit;
  min: number;
  max: number;
}

/**
 * Turns Deriv's min/max per expiry type into units: tick contracts use ticks; intraday contracts
 * can be set in seconds, minutes or hours; daily ones in days.
 */
function durationOptions(entries: AvailableContract[]): DurationOption[] {
  const out: DurationOption[] = [];
  for (const e of entries) {
    const min = parseDuration(e.min_contract_duration);
    const max = parseDuration(e.max_contract_duration);
    if (!min || !max) continue; // no_expiry contracts (multipliers, accumulators) have "0"
    if (e.expiry_type === "tick") {
      out.push({ unit: "t", min: min.value, max: max.value });
    } else {
      const minS = min.unit === "t" ? 0 : min.value * SECONDS[min.unit];
      const maxS = max.unit === "t" ? 0 : max.value * SECONDS[max.unit];
      const units: Exclude<DurationUnit, "t">[] = e.expiry_type === "daily" ? ["d"] : ["s", "m", "h"];
      for (const unit of units) {
        const lo = Math.max(1, Math.ceil(minS / SECONDS[unit]));
        // Intraday "1d" maximum means up to (not including) a day in s/m/h
        const hi = Math.floor((e.expiry_type === "daily" ? maxS : maxS - 1) / SECONDS[unit]);
        if (hi >= lo) out.push({ unit, min: lo, max: hi });
      }
    }
  }
  // Same unit from two entries: keep the widest range
  const merged = new Map<DurationUnit, DurationOption>();
  for (const o of out) {
    const prev = merged.get(o.unit);
    merged.set(o.unit, prev ? { unit: o.unit, min: Math.min(prev.min, o.min), max: Math.max(prev.max, o.max) } : o);
  }
  const order: DurationUnit[] = ["t", "s", "m", "h", "d"];
  return [...merged.values()].sort((a, b) => order.indexOf(a.unit) - order.indexOf(b.unit));
}

export interface TradeType {
  id: string;
  label: string;
  sides: { contractType: string; label: string; equalsContractType?: string; lastDigits?: number[] }[];
  /** Empty for contracts with no fixed end (Multipliers, Accumulators). */
  durations: DurationOption[];
  /** Barrier boxes to show (0, 1 or 2). Default per duration kind: relative ("+0.36") or absolute ("642.91"). */
  barriers: number;
  defaultBarriers: { tick?: BarrierDefault; intraday?: BarrierDefault; daily?: BarrierDefault };
  barrierChoices?: string[];
  multipliers?: number[];
  growthRates?: number[];
  cancellationOptions?: string[];
  payoutChoices?: number[];
  minStake?: number;
  maxStake?: number;
  defaultStake?: number;
}

interface BarrierDefault {
  barrier?: string;
  high?: string;
  low?: string;
}

const tradeTypesCache = new Map<string, { at: number; data: TradeType[] }>();

export async function getTradeTypes(symbol: string): Promise<TradeType[]> {
  const cached = tradeTypesCache.get(symbol);
  if (cached && Date.now() - cached.at < TRADE_TYPES_TTL_MS) return cached.data;

  const msg = await request({ contracts_for: symbol });
  if (msg.error) throw Object.assign(new Error(msg.error.message), { code: msg.error.code });
  const available = (msg.contracts_for as { available: AvailableContract[] }).available ?? [];
  const byType = new Map<string, AvailableContract[]>();
  for (const c of available) byType.set(c.contract_type, [...(byType.get(c.contract_type) ?? []), c]);

  const data: TradeType[] = [];
  for (const def of TRADE_TYPES) {
    // [contract type, button label, Deriv's entries for it] for the sides this asset offers
    const sides = Object.entries(def.sides)
      .map(([type, label]) => [type, label, byType.get(type) ?? []] as const)
      .filter(([, , list]) => list.length > 0);
    const firstSide = sides[0];
    const first = firstSide?.[2][0];
    if (!firstSide || !first) continue;

    const defaults: TradeType["defaultBarriers"] = {};
    for (const e of def.barrierInputs ? firstSide[2] : []) {
      const kind = e.expiry_type as "tick" | "intraday" | "daily";
      if (!["tick", "intraday", "daily"].includes(kind)) continue;
      defaults[kind] = e.barriers === 2
        ? { high: e.high_barrier ?? undefined, low: e.low_barrier ?? undefined }
        : { barrier: e.barrier ?? undefined };
    }

    data.push({
      id: def.id,
      label: def.label,
      sides: sides.map(([type, label, list]) => {
        const equals = EQUALS_VERSION[type];
        const digits = list[0]?.last_digit_range;
        return {
          contractType: type,
          label,
          ...(equals && byType.has(equals) ? { equalsContractType: equals } : {}),
          ...(digits ? { lastDigits: digits } : {}),
        };
      }),
      durations: durationOptions(firstSide[2]),
      barriers: def.barrierInputs ?? 0,
      defaultBarriers: defaults,
      ...(first.barrier_choices ? { barrierChoices: first.barrier_choices } : {}),
      ...(first.multiplier_range ? { multipliers: first.multiplier_range } : {}),
      ...(first.growth_rate_range ? { growthRates: first.growth_rate_range } : {}),
      ...(first.cancellation_range ? { cancellationOptions: first.cancellation_range } : {}),
      ...(first.payout_choices ? { payoutChoices: first.payout_choices } : {}),
      ...(typeof first.min_stake === "number" ? { minStake: first.min_stake } : {}),
      ...(typeof first.max_stake === "number" ? { maxStake: first.max_stake } : {}),
      ...(typeof first.default_stake === "number" ? { defaultStake: first.default_stake } : {}),
    });
  }

  tradeTypesCache.set(symbol, { at: Date.now(), data });
  return data;
}

// ---------- Quotes ----------

export interface QuoteParams {
  symbol: string;
  contractType: string;
  amount: number;
  basis?: "stake" | "payout";
  duration?: number;
  durationUnit?: DurationUnit;
  /** "End time" instead of a duration: when the contract ends, as epoch seconds. */
  dateExpiry?: number;
  barrier?: string;
  barrier2?: string;
  multiplier?: number;
  growthRate?: number;
  cancellation?: string;
  payoutPerPoint?: number;
  selectedTick?: number;
}

export interface Quote {
  ok: boolean;
  askPrice?: number;
  payout?: number;
  longcode?: string;
  spot?: number;
  /** Deriv's own explanation when the settings are not allowed. */
  message?: string;
}

/** Asks Deriv to price the trade (proposal, no subscription). Never buys. */
export async function getQuote(p: QuoteParams): Promise<Quote> {
  const payload: Record<string, unknown> = {
    proposal: 1,
    underlying_symbol: p.symbol,
    contract_type: p.contractType,
    currency: await getAccountCurrency(),
    amount: p.amount,
    basis: p.basis ?? "stake",
  };
  if (p.dateExpiry !== undefined) {
    payload.date_expiry = p.dateExpiry;
  } else if (p.duration !== undefined) {
    payload.duration = p.duration;
    payload.duration_unit = p.durationUnit ?? "t";
  }
  if (p.barrier !== undefined) payload.barrier = p.barrier;
  if (p.barrier2 !== undefined) payload.barrier2 = p.barrier2;
  if (p.multiplier !== undefined) payload.multiplier = p.multiplier;
  if (p.growthRate !== undefined) payload.growth_rate = p.growthRate;
  if (p.cancellation !== undefined) payload.cancellation = p.cancellation;
  if (p.payoutPerPoint !== undefined) payload.payout_per_point = p.payoutPerPoint;
  if (p.selectedTick !== undefined) payload.selected_tick = p.selectedTick;

  const msg = await request(payload);
  if (msg.error) return { ok: false, message: msg.error.message };
  const q = msg.proposal as { ask_price: number; payout: number; longcode: string; spot: number };
  return { ok: true, askPrice: q.ask_price, payout: q.payout, longcode: q.longcode, spot: q.spot };
}
