// Risk checks. EVERY trade must pass checkTrade() before it is sent to Deriv; nothing may bypass
// this (see CLAUDE.md). The trading code (server/src/market/trading.ts) is the only caller of
// Deriv's `buy`, and it calls checkTrade() first, then recordBuy() / recordSettled().
//
// Limits are per app user, per account type (demo / real), per UTC day, set in server/.env:
//   RISK_MAX_STAKE            largest stake for one trade
//   RISK_MAX_OPEN             trades open at the same time
//   RISK_MAX_TRADES_PER_DAY   trades bought per day
//   RISK_DAILY_LOSS_LIMIT     most a user can lose in a day: today's net loss PLUS the stakes still
//                             at risk in open trades PLUS this trade's stake must stay within it
//   RISK_MIN_INTERVAL_MS      minimum time between two trades (stops accidental double taps)
// Real-money trades use the same names with RISK_REAL_ (e.g. RISK_REAL_MAX_STAKE), with stricter
// defaults. Demo and real are counted separately.
//
// The counters live in memory, so they restart from zero when the server restarts.

export type AccountType = "demo" | "real";

const num = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const RISK_LIMITS: Record<AccountType, { maxStake: number; maxOpen: number; maxTradesPerDay: number; dailyLossLimit: number; minIntervalMs: number }> = {
  demo: {
    maxStake: num("RISK_MAX_STAKE", 50),
    maxOpen: num("RISK_MAX_OPEN", 5),
    maxTradesPerDay: num("RISK_MAX_TRADES_PER_DAY", 200),
    dailyLossLimit: num("RISK_DAILY_LOSS_LIMIT", 200),
    minIntervalMs: num("RISK_MIN_INTERVAL_MS", 1000),
  },
  real: {
    maxStake: num("RISK_REAL_MAX_STAKE", 10),
    maxOpen: num("RISK_REAL_MAX_OPEN", 3),
    maxTradesPerDay: num("RISK_REAL_MAX_TRADES_PER_DAY", 50),
    dailyLossLimit: num("RISK_REAL_DAILY_LOSS_LIMIT", 50),
    minIntervalMs: num("RISK_REAL_MIN_INTERVAL_MS", 1500),
  },
};

interface UserDay {
  day: string; // UTC date, e.g. 2026-10-27
  trades: number;
  netProfit: number; // settled trades today: wins minus losses
  openStakes: Map<number, number>; // contract id -> stake still at risk
  lastTradeAt: number;
  // A trade being bought right now (between checkTrade and recordBuy): counted as open
  pending: number;
}

const users = new Map<string, UserDay>();
const today = () => new Date().toISOString().slice(0, 10);

// Demo and real are counted separately for each user
function stateFor(userId: string, type: AccountType): UserDay {
  const key = `${userId}:${type}`;
  let s = users.get(key);
  if (!s || s.day !== today()) {
    // New day: counts start again, but trades still open stay open
    s = { day: today(), trades: 0, netProfit: 0, openStakes: s?.openStakes ?? new Map(), lastTradeAt: s?.lastTradeAt ?? 0, pending: 0 };
    users.set(key, s);
  }
  return s;
}

export type RiskResult = { ok: true } | { ok: false; reason: string };

/**
 * Decides whether this user may place this trade now on this account. On success the trade is
 * counted as "pending": call recordBuy() if Deriv bought it, or cancelPending() if the buy failed.
 */
export function checkTrade(userId: string, type: AccountType, stake: number): RiskResult {
  const s = stateFor(userId, type);
  const L = RISK_LIMITS[type];
  const atRisk = [...s.openStakes.values()].reduce((a, b) => a + b, 0);
  const lossSoFar = Math.max(0, -s.netProfit);

  if (!(stake > 0)) return { ok: false, reason: "Stake must be above 0." };
  if (stake > L.maxStake) return { ok: false, reason: `Maximum stake per ${type} trade is ${L.maxStake}.` };
  if (Date.now() - s.lastTradeAt < L.minIntervalMs) return { ok: false, reason: "One trade at a time: wait a moment and try again." };
  if (s.openStakes.size + s.pending >= L.maxOpen) return { ok: false, reason: `You already have ${L.maxOpen} ${type} trades open. Wait for one to finish or sell one.` };
  if (s.trades + s.pending >= L.maxTradesPerDay) return { ok: false, reason: `Daily limit of ${L.maxTradesPerDay} ${type} trades reached. Trading opens again tomorrow (UTC).` };
  if (lossSoFar + atRisk + stake > L.dailyLossLimit) {
    const room = Math.max(0, L.dailyLossLimit - lossSoFar - atRisk);
    return {
      ok: false,
      reason: room > 0
        ? `This stake could take you past your ${type} daily loss limit of ${L.dailyLossLimit}. The most you can stake now is ${room.toFixed(2)}.`
        : `Your ${type} daily loss limit of ${L.dailyLossLimit} is reached (including open trades). Trading opens again tomorrow (UTC).`,
    };
  }

  s.pending++;
  s.lastTradeAt = Date.now();
  return { ok: true };
}

/** The buy that checkTrade() allowed did not happen (Deriv refused it, network error...). */
export function cancelPending(userId: string, type: AccountType): void {
  const s = stateFor(userId, type);
  s.pending = Math.max(0, s.pending - 1);
}

/** Deriv bought the trade: it now counts as a trade today and as open stake at risk. */
export function recordBuy(userId: string, type: AccountType, contractId: number, stake: number): void {
  const s = stateFor(userId, type);
  s.pending = Math.max(0, s.pending - 1);
  s.trades++;
  s.openStakes.set(contractId, stake);
}

/** The contract ended (won, lost or sold): its result counts towards today's profit/loss. */
export function recordSettled(userId: string, type: AccountType, contractId: number, profit: number): void {
  const s = stateFor(userId, type);
  if (!s.openStakes.delete(contractId)) return; // already settled (duplicate update)
  s.netProfit += profit;
}

/** Where the user stands today on this account, for the app to show. */
export function riskSummary(userId: string, type: AccountType) {
  const s = stateFor(userId, type);
  const L = RISK_LIMITS[type];
  const atRisk = [...s.openStakes.values()].reduce((a, b) => a + b, 0);
  return {
    limits: L,
    tradesToday: s.trades,
    netProfitToday: Math.round(s.netProfit * 100) / 100,
    openTrades: s.openStakes.size,
    stakeAtRisk: Math.round(atRisk * 100) / 100,
    // How much more could still be lost today
    lossRoomLeft: Math.max(0, Math.round((L.dailyLossLimit - Math.max(0, -s.netProfit) - atRisk) * 100) / 100),
  };
}
