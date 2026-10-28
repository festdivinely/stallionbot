// routes/marketRoutes.js - Deriv options market data for the app.
//   GET  /ticks                        live prices (public: the welcome screen shows them)
//   GET  /assets                       every options asset, grouped like Deriv SmartTrader
//   GET  /assets/:symbol/trade-types   trade types + settings Deriv allows for that asset
//   POST /quote                        Deriv's price for a trade, or why its settings are wrong
//                                      (logged-in users only; quotes only, never buys)
//   GET  /accounts                     demo and real accounts with their balances
//   POST /trade?account=demo|real      buy on that account, after the risk checks
//   GET  /trades?account=demo|real     that account's balance, open and recent trades, risk standing
//   POST /trades/:contractId/sell?account=demo|real   close an open trade early at the market price
//   (the last four: logged-in users only, each user sees and sells only their own trades)
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { protectFast } from "../middleware/authMiddleware.js";

const router = Router();

// The Deriv modules need DERIV_* settings in server/.env. If they are missing or wrong, keep the
// rest of the API running and just report market data as unavailable.
let feed = null;
let catalog = null;
let trading = null;
try {
    feed = await import("../../market/tickFeed.js");
    catalog = await import("../../market/catalog.js");
    trading = await import("../../market/trading.js");
    feed.startTickFeed();
    // Warm the asset list so the first app request is quick (and asset names are known)
    catalog.getAssets().catch((error) => console.error("[market] asset list:", error.message));
} catch (error) {
    console.error("[market] market data disabled:", error.message);
}

// These routes have their own per-minute limits instead of the strict global /api limit
// (50-100 requests per 15 minutes). Separate budgets, so busy price polling can never block
// quotes or the asset lists, and the other way round.
const perMinute = (max, message) =>
    rateLimit({ windowMs: 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message: { message } });
// Prices: about one request a second per visible screen
const ticksLimiter = perMinute(240, "Too many price requests");
// Quotes: two sides every few seconds, plus one per settings change
const quoteLimiter = perMinute(120, "Too many price quotes, slow down a little");
// Asset list and trade types: one per asset picked
const catalogLimiter = perMinute(120, "Too many market list requests");
// Buying and selling (the risk module also enforces a minimum gap between trades)
const tradeLimiter = perMinute(30, "Too many trades in a minute, slow down");
// Open trades and balance: polled about once a second while the Options screen is open
const tradesLimiter = perMinute(120, "Too many trade updates requested");

const SYMBOL = /^\w{2,30}$/;
const unavailable = (res) => res.status(503).json({ message: "Market data unavailable" });

router.get("/ticks", ticksLimiter, (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!feed) return res.status(503).json({ live: false, symbols: [], message: "Market data unavailable" });
    // ?symbols=R_100,frxEURUSD (optional; at most 5)
    const symbols = typeof req.query.symbols === "string" ? req.query.symbols.split(",").filter((s) => SYMBOL.test(s)) : [];
    res.json(feed.getTickSnapshot(symbols, catalog?.assetNames() ?? {}));
});

router.get("/assets", catalogLimiter, async (req, res) => {
    if (!catalog) return unavailable(res);
    try {
        res.json({ categories: await catalog.getAssets() });
    } catch (error) {
        console.error("[market] assets:", error.message);
        res.status(502).json({ message: "Could not load the asset list from Deriv" });
    }
});

router.get("/assets/:symbol/trade-types", catalogLimiter, async (req, res) => {
    if (!catalog) return unavailable(res);
    const { symbol } = req.params;
    if (!SYMBOL.test(symbol)) return res.status(400).json({ message: "Invalid symbol" });
    try {
        res.json({ symbol, tradeTypes: await catalog.getTradeTypes(symbol) });
    } catch (error) {
        console.error(`[market] trade types ${symbol}:`, error.message);
        // Deriv rejected the symbol itself (e.g. unknown) vs. we could not reach Deriv
        res.status(error.code ? 400 : 502).json({ message: error.code ? error.message : "Could not load trade types from Deriv" });
    }
});

// Only these fields, with these types, are passed on to Deriv
const QUOTE_FIELDS = {
    symbol: (v) => typeof v === "string" && SYMBOL.test(v),
    contractType: (v) => typeof v === "string" && /^[A-Z]{2,20}$/.test(v),
    amount: (v) => typeof v === "number" && v > 0 && v <= 100000,
    basis: (v) => v === "stake" || v === "payout",
    duration: (v) => Number.isInteger(v) && v > 0 && v <= 100000,
    durationUnit: (v) => ["t", "s", "m", "h", "d"].includes(v),
    // End time (epoch seconds): in the future, at most a year ahead
    dateExpiry: (v) => Number.isInteger(v) && v > Date.now() / 1000 && v < Date.now() / 1000 + 366 * 86400,
    barrier: (v) => typeof v === "string" && /^[+-]?\d+\.?\d*$/.test(v) && v.length <= 20,
    barrier2: (v) => typeof v === "string" && /^[+-]?\d+\.?\d*$/.test(v) && v.length <= 20,
    multiplier: (v) => typeof v === "number" && v > 0,
    growthRate: (v) => typeof v === "number" && v > 0 && v < 1,
    cancellation: (v) => typeof v === "string" && /^\w{1,10}$/.test(v),
    payoutPerPoint: (v) => typeof v === "number" && v > 0,
    selectedTick: (v) => Number.isInteger(v) && v >= 1 && v <= 10,
};

// This router is mounted before app.js's body parser, so the quote route parses JSON itself
/** The trade settings from the body, checked against QUOTE_FIELDS; sends a 400 and returns null if wrong. */
function readTradeParams(req, res) {
    const params = {};
    for (const [key, value] of Object.entries(req.body ?? {})) {
        const check = QUOTE_FIELDS[key];
        if (!check) return res.status(400).json({ message: `Unknown field: ${key}` }), null;
        if (value === undefined || value === null) continue;
        if (!check(value)) return res.status(400).json({ message: `Invalid ${key}` }), null;
        params[key] = value;
    }
    if (!params.symbol || !params.contractType || !params.amount) {
        return res.status(400).json({ message: "symbol, contractType and amount are required" }), null;
    }
    return params;
}

router.post("/quote", quoteLimiter, express.json({ limit: "4kb" }), protectFast, async (req, res) => {
    if (!catalog) return unavailable(res);
    const params = readTradeParams(req, res);
    if (!params) return;
    try {
        res.json(await catalog.getQuote(params));
    } catch (error) {
        console.error("[market] quote:", error.message);
        res.status(502).json({ ok: false, message: "Could not reach Deriv for a price" });
    }
});

// ---------- Trading (every buy passes server/src/risk inside placeTrade) ----------
// Which account: ?account=real for real money, anything else (or nothing) = demo. Only the exact
// word "real" selects real money, so a missing or mistyped value can never trade it.
const accountOf = (req) => (req.query.account === "real" ? "real" : "demo");

router.get("/accounts", tradesLimiter, protectFast, async (req, res) => {
    if (!trading) return unavailable(res);
    res.set("Cache-Control", "no-store");
    try {
        res.json(await trading.getAccountsSummary());
    } catch (error) {
        console.error("[trade] accounts:", error.message);
        res.status(502).json({ message: "Could not load your Deriv accounts" });
    }
});

router.post("/trade", tradeLimiter, express.json({ limit: "4kb" }), protectFast, async (req, res) => {
    if (!trading) return unavailable(res);
    const params = readTradeParams(req, res);
    if (!params) return;
    const result = await trading.placeTrade(String(req.user.id), params, accountOf(req));
    res.status(result.ok ? 200 : 400).json(result);
});

router.get("/trades", tradesLimiter, protectFast, async (req, res) => {
    if (!trading) return unavailable(res);
    res.set("Cache-Control", "no-store");
    res.json(await trading.getTrades(String(req.user.id), accountOf(req)));
});

router.post("/trades/:contractId/sell", tradeLimiter, protectFast, async (req, res) => {
    if (!trading) return unavailable(res);
    const contractId = Number(req.params.contractId);
    if (!Number.isInteger(contractId) || contractId <= 0) return res.status(400).json({ ok: false, message: "Invalid trade" });
    try {
        const result = await trading.sellTrade(String(req.user.id), accountOf(req), contractId);
        res.status(result.ok ? 200 : 400).json(result);
    } catch (error) {
        console.error("[trade] sell:", error.message);
        res.status(502).json({ ok: false, message: "Could not reach Deriv to sell" });
    }
});

export default router;
