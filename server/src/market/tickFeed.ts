// Live prices for the app, from the shared Deriv demo WebSocket. Keeps the last minute of ticks
// per symbol in memory; the HTTP API reads from here, so any number of phones can watch prices
// while we hold one Deriv connection.
//  - DEFAULT_SYMBOLS are always followed (the welcome screen shows them).
//  - Any other symbol is followed from the moment the app asks for it, and dropped after
//    IDLE_DROP_MS without anyone asking (so we don't keep dozens of streams open).
// Market data only: nothing here places trades.

import type { DerivMessage } from "../deriv/socket.js";
import { getSharedSocket } from "../deriv/shared.js";

const DEFAULT_SYMBOLS = ["R_75", "R_100"];
const HISTORY_SIZE = 60;
// No tick for this long means a symbol is not really live (Deriv sends one every 1-2s for synthetics)
const STALE_AFTER_MS = 10_000;
const IDLE_DROP_MS = 2 * 60_000;
const MAX_FOLLOWED = 25;

interface Tick {
  quote: number;
  epoch: number;
}

interface Followed {
  name: string;
  ticks: Tick[];
  // Decimals Deriv quotes the symbol with. The app needs it to read the last digit: JSON drops
  // trailing zeros, so 610.50 arrives as 610.5.
  pipSize: number | null;
  lastTickAt: number;
  lastAskedAt: number;
  subscriptionId?: string;
  error?: string;
}

interface HistoryMessage extends DerivMessage {
  msg_type: "history";
  echo_req: { ticks_history: string };
  history: { prices: number[]; times: number[] };
  pip_size?: number;
  subscription?: { id: string };
}

interface TickMessage extends DerivMessage {
  msg_type: "tick";
  tick: { symbol: string; quote: number; epoch: number; pip_size?: number };
  subscription?: { id: string };
}

const followed = new Map<string, Followed>();
let started = false;

const SYMBOL_PATTERN = /^\w{2,30}$/;

function subscribe(symbol: string): void {
  try {
    // ticks_history with subscribe:1 sends the last minute first (chart is full at once), then live ticks
    getSharedSocket().send({ ticks_history: symbol, end: "latest", count: HISTORY_SIZE, style: "ticks", subscribe: 1 });
  } catch {
    // Not connected yet: the onOpen handler subscribes everything once it is
  }
}

/** Starts the shared feed once; later calls do nothing. */
export function startTickFeed(): void {
  if (started) return;
  started = true;
  follow("R_75", "Volatility 75 Index");
  follow("R_100", "Volatility 100 Index");
  const s = getSharedSocket();

  // Runs after every (re)connect, so the subscriptions always come back
  s.onOpen(() => {
    for (const [symbol, f] of followed) {
      f.subscriptionId = undefined;
      subscribe(symbol);
    }
  });

  s.onMessage((msg) => {
    if (msg.msg_type !== "history" && msg.msg_type !== "tick") return;
    if (msg.error) {
      const symbol = (msg.echo_req as { ticks_history?: string } | undefined)?.ticks_history;
      const f = symbol ? followed.get(symbol) : undefined;
      if (f) f.error = msg.error.message;
      console.error(`[market] ${msg.msg_type} ${symbol ?? ""} error ${msg.error.code}: ${msg.error.message}`);
      return;
    }
    if (msg.msg_type === "history") {
      const { echo_req, history: h, pip_size, subscription } = msg as HistoryMessage;
      const f = followed.get(echo_req.ticks_history);
      if (!f) return;
      f.ticks = h.prices.map((quote, i) => ({ quote, epoch: h.times[i] ?? 0 })).slice(-HISTORY_SIZE);
      if (typeof pip_size === "number") f.pipSize = pip_size;
      if (subscription?.id) f.subscriptionId = subscription.id;
      f.lastTickAt = Date.now();
      f.error = undefined;
    } else {
      const { tick, subscription } = msg as TickMessage;
      const f = followed.get(tick.symbol);
      if (!f) return;
      if (typeof tick.pip_size === "number") f.pipSize = tick.pip_size;
      if (subscription?.id) f.subscriptionId = subscription.id;
      f.ticks.push({ quote: tick.quote, epoch: tick.epoch });
      if (f.ticks.length > HISTORY_SIZE) f.ticks.splice(0, f.ticks.length - HISTORY_SIZE);
      f.lastTickAt = Date.now();
    }
  });

  // Drop symbols nobody has asked about for a while
  setInterval(() => {
    const now = Date.now();
    for (const [symbol, f] of followed) {
      if (DEFAULT_SYMBOLS.includes(symbol) || now - f.lastAskedAt < IDLE_DROP_MS) continue;
      followed.delete(symbol);
      if (f.subscriptionId) {
        try {
          getSharedSocket().send({ forget: f.subscriptionId });
        } catch {
          // Socket down: the subscription is gone anyway
        }
      }
    }
  }, 30_000).unref();
}

function follow(symbol: string, name = symbol): Followed | undefined {
  let f = followed.get(symbol);
  if (!f) {
    if (followed.size >= MAX_FOLLOWED) return undefined;
    f = { name, ticks: [], pipSize: null, lastTickAt: 0, lastAskedAt: Date.now() };
    followed.set(symbol, f);
    if (started) subscribe(symbol);
  }
  f.lastAskedAt = Date.now();
  return f;
}

/**
 * What the app receives: recent prices (oldest first) for the requested symbols, or for the
 * default ones when none are given. `names` maps symbol -> display name when the caller knows it.
 */
export function getTickSnapshot(requested?: string[], names: Record<string, string> = {}) {
  const symbols = (requested?.length ? requested : DEFAULT_SYMBOLS).filter((s) => SYMBOL_PATTERN.test(s)).slice(0, 5);
  const list = symbols.map((symbol) => {
    const f = follow(symbol, names[symbol]);
    if (f && names[symbol]) f.name = names[symbol];
    return {
      symbol,
      name: f?.name ?? names[symbol] ?? symbol,
      quotes: f?.ticks.map((t) => t.quote) ?? [],
      lastEpoch: f?.ticks.at(-1)?.epoch ?? null,
      pipSize: f?.pipSize ?? null,
      live: !!f && f.lastTickAt > 0 && Date.now() - f.lastTickAt < STALE_AFTER_MS,
      error: f ? (f.error ?? null) : "Too many markets open at once, try again shortly",
    };
  });
  return { live: list.some((s) => s.live), symbols: list };
}
