// Live prices for the app's welcome screen: one shared Deriv demo WebSocket subscribes to a few
// volatility indices and keeps the last minute of ticks in memory. The HTTP API reads from here,
// so any number of phones can show live prices while we hold a single Deriv connection.
// Market data only: nothing here places trades.

import { DerivSocket, type DerivMessage } from "../deriv/socket.js";

export const MARKET_SYMBOLS = {
  R_75: "Volatility 75 Index",
  R_100: "Volatility 100 Index",
} as const;

type MarketSymbol = keyof typeof MARKET_SYMBOLS;

const HISTORY_SIZE = 60;
// No tick for this long means we are not really live (Deriv sends one every 1-2s)
const STALE_AFTER_MS = 10_000;

interface Tick {
  quote: number;
  epoch: number;
}

interface HistoryMessage extends DerivMessage {
  msg_type: "history";
  echo_req: { ticks_history: string };
  history: { prices: number[]; times: number[] };
}

interface TickMessage extends DerivMessage {
  msg_type: "tick";
  tick: { symbol: string; quote: number; epoch: number };
}

const history: Record<MarketSymbol, Tick[]> = { R_75: [], R_100: [] };
let lastTickAt = 0;
let socket: DerivSocket | undefined;

const isMarketSymbol = (s: string): s is MarketSymbol => s in MARKET_SYMBOLS;

function push(symbol: MarketSymbol, tick: Tick): void {
  const list = history[symbol];
  list.push(tick);
  if (list.length > HISTORY_SIZE) list.splice(0, list.length - HISTORY_SIZE);
  lastTickAt = Date.now();
}

/** Starts the shared feed once; later calls do nothing. */
export function startTickFeed(): void {
  if (socket) return;
  const s = new DerivSocket();
  socket = s;

  // Runs after every (re)connect, so the subscriptions always come back.
  // ticks_history with subscribe:1 sends the last minute first (chart is full at once), then live ticks.
  s.onOpen(() => {
    for (const symbol of Object.keys(MARKET_SYMBOLS)) {
      s.send({ ticks_history: symbol, end: "latest", count: HISTORY_SIZE, style: "ticks", subscribe: 1 });
    }
  });

  s.onMessage((msg) => {
    if (msg.error) {
      console.error(`[market] ${msg.msg_type} error ${msg.error.code}: ${msg.error.message}`);
      return;
    }
    if (msg.msg_type === "history") {
      const { echo_req, history: h } = msg as HistoryMessage;
      const symbol = echo_req.ticks_history;
      if (!isMarketSymbol(symbol)) return;
      history[symbol] = h.prices.map((quote, i) => ({ quote, epoch: h.times[i] ?? 0 })).slice(-HISTORY_SIZE);
      lastTickAt = Date.now();
    } else if (msg.msg_type === "tick") {
      const { tick } = msg as TickMessage;
      if (isMarketSymbol(tick.symbol)) push(tick.symbol, { quote: tick.quote, epoch: tick.epoch });
    }
  });

  void s.connect();
}

/** What the app receives: whether data is fresh, and recent prices per symbol (oldest first). */
export function getTickSnapshot() {
  return {
    live: lastTickAt > 0 && Date.now() - lastTickAt < STALE_AFTER_MS,
    symbols: (Object.keys(MARKET_SYMBOLS) as MarketSymbol[]).map((symbol) => ({
      symbol,
      name: MARKET_SYMBOLS[symbol],
      quotes: history[symbol].map((t) => t.quote),
      lastEpoch: history[symbol].at(-1)?.epoch ?? null,
    })),
  };
}
