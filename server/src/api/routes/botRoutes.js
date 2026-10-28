// routes/botRoute.js
import express from "express";
import crypto from "crypto";
import {
    getAllBots,
    getUserBots,
    acquireBot,
    updateUserBot,
    startUserBot,
    stopUserBot,
    deleteUserBot,
    updateBotProgress,
    createBotTemplate,
    updateBotTemplate,
} from "../controllers/botControllers.js";
import { protect, requireRole } from "../middleware/authMiddleware.js";
import { logRequest } from "../helpers/helperFunctions.js";

const router = express.Router();

// Admin only routes
router.post("/", logRequest, protect, requireRole(["admin"]), createBotTemplate);
router.patch("/:id", logRequest, protect, requireRole(["admin"]), updateBotTemplate);

// Public route (get all available bots)
router.get("/", getAllBots);

// Protected user routes
router.get("/user", logRequest, protect, getUserBots);
router.post("/acquire", logRequest, protect, acquireBot);
router.patch("/:botId", logRequest, protect, updateUserBot);
router.post("/:botId/start", logRequest, protect, startUserBot);
router.post("/:botId/stop", logRequest, protect, stopUserBot);
router.delete("/:botId", logRequest, protect, deleteUserBot);

// Progress update from the bot runner (a server, not the app): it must send the secret
// INTERNAL_API_KEY from server/.env in the X-Internal-Key header. Without that key set, it's closed.
const requireInternalKey = (req, res, next) => {
    const key = process.env.INTERNAL_API_KEY;
    const sent = req.get("x-internal-key") || "";
    const ok = key && key.length >= 16 && sent.length === key.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(key));
    if (!ok) return res.status(403).json({ message: "Forbidden" });
    next();
};
router.post("/:botId/progress", requireInternalKey, updateBotProgress);

export default router;