// routes/strategyRoutes.js - the Split Money strategy (server/src/risk/splitMoney.ts).
// All routes: logged-in users only, ?account=demo|real (anything else = demo), own pots only.
//   GET  /split            the strategy: settings, pots, loans, history, Deriv balance
//   PUT  /split/settings   set up the pots or change the rules
//   POST /split/start      turn the strategy on (every trade then needs a pot)
//   POST /split/stop       turn it off
//   POST /split/lend       { from, to, amount }: a loan from one pot to another
//   POST /split/repay      { loanId, amount? }: pay a loan back (all of it when no amount)
//   POST /split/adjust     shrink the pots to fit the Deriv balance and resume
//   POST /split/reset      delete the strategy on this account (to set it up fresh)
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { protectFast, requireTrader } from "../middleware/authMiddleware.js";

const router = Router();

let split = null;
let trading = null;
try {
    split = await import("../../risk/splitMoney.js");
    trading = await import("../../market/trading.js");
} catch (error) {
    console.error("[split] strategy disabled:", error.message);
}

// Its own limit (mounted before the strict global /api limit, like the market routes)
const limiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, message: { message: "Too many requests, slow down a little" } });

// Only the exact word "real" selects the real account
const accountOf = (req) => (req.query.account === "real" ? "real" : "demo");
const POT_ID = /^[sb]\d{1,2}$/;
const LOAN_ID = /^L\d{1,9}$/;
const isAmount = (v) => typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 10_000_000;

router.use(limiter, express.json({ limit: "4kb" }), protectFast, requireTrader, (req, res, next) => {
    if (!split || !trading) return res.status(503).json({ message: "Strategy unavailable" });
    res.set("Cache-Control", "no-store");
    next();
});

/** Runs an action, then answers with the strategy as it is now. */
async function answer(req, res, action) {
    const userId = String(req.user.id);
    const type = accountOf(req);
    try {
        const balance = await trading.balanceFor(type);
        await split.ensureLoaded(userId, type);
        const result = action ? await action(userId, type, balance) : { ok: true };
        res.status(result.ok ? 200 : 400).json({ ...result, strategy: split.viewOf(userId, type, balance) });
    } catch (error) {
        console.error("[split]", error.message);
        res.status(503).json({ ok: false, message: "Could not reach the database. Try again in a moment." });
    }
}

router.get("/split", (req, res) => answer(req, res, null));

router.put("/split/settings", (req, res) => {
    const b = req.body ?? {};
    const settings = {
        sections: b.sections,
        sectionAmount: b.sectionAmount,
        banks: Array.isArray(b.banks) ? b.banks.slice(0, 5) : b.banks,
        loanHours: b.loanHours,
        coolDownMin: b.coolDownMin,
        dailyLossCap: b.dailyLossCap,
    };
    return answer(req, res, (userId, type, balance) => split.saveSettings(userId, type, settings, balance));
});

router.post("/split/start", (req, res) => answer(req, res, (userId, type, balance) => split.setActive(userId, type, true, balance)));
router.post("/split/stop", (req, res) => answer(req, res, (userId, type, balance) => split.setActive(userId, type, false, balance)));

router.post("/split/lend", (req, res) => {
    const { from, to, amount } = req.body ?? {};
    if (!POT_ID.test(String(from)) || !POT_ID.test(String(to)) || !isAmount(amount)) return res.status(400).json({ ok: false, message: "Pick two pots and an amount." });
    return answer(req, res, (userId, type) => split.lend(userId, type, from, to, amount));
});

router.post("/split/repay", (req, res) => {
    const { loanId, amount } = req.body ?? {};
    if (!LOAN_ID.test(String(loanId)) || (amount !== undefined && !isAmount(amount))) return res.status(400).json({ ok: false, message: "Invalid loan." });
    return answer(req, res, (userId, type) => split.repay(userId, type, loanId, amount));
});

router.post("/split/adjust", (req, res) => answer(req, res, (userId, type, balance) => split.adjustToBalance(userId, type, balance)));
router.post("/split/reset", (req, res) => answer(req, res, (userId, type) => split.resetStrategy(userId, type)));

export default router;
