// routes/marketRoutes.js - public, read-only market data for the app (no login needed:
// the welcome screen shows it before the user signs in).
import { Router } from "express";
import rateLimit from "express-rate-limit";

const router = Router();

// The Deriv feed needs DERIV_* settings in server/.env. If they are missing or wrong, keep the rest
// of the API running and just report market data as unavailable.
let feed = null;
try {
    feed = await import("../../market/tickFeed.js");
    feed.startTickFeed();
} catch (error) {
    console.error("[market] live prices disabled:", error.message);
}

// The app polls about once a second while the welcome screen is open, so this gets its own
// limit instead of the strict global /api limit (50-100 requests per 15 minutes).
const marketLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { live: false, message: "Too many market data requests" },
});

router.get("/ticks", marketLimiter, (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!feed) {
        return res.status(503).json({ live: false, symbols: [], message: "Market data unavailable" });
    }
    res.json(feed.getTickSnapshot());
});

export default router;
