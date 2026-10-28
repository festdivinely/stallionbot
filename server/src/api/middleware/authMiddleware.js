// backend/middleware/authMiddleware.js
import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import Users from "../models/userModel.js";

if (!process.env.PUBLIC_KEY) {
    throw new Error("Missing PUBLIC_KEY environment variable");
}

// PUBLIC_KEY is stored base64-encoded (authController and userModel decode it the same way).
// Using the encoded text directly made every token check fail. Raw PEM is accepted too.
const publicKey = process.env.PUBLIC_KEY.trim().startsWith("-----BEGIN")
    ? process.env.PUBLIC_KEY
    : Buffer.from(process.env.PUBLIC_KEY, "base64").toString("utf-8");

const ISSUER = process.env.ISSUER || "quantumrobots.com";
const AUDIENCE = process.env.AUDIENCE || "api.quantumrobots.com";

// New: CSRF middleware for protected routes
export const csrfProtect = asyncHandler(async (req, res, next) => {
    const csrfToken = req.headers["x-csrf-token"];
    if (!csrfToken) {
        console.warn("Missing CSRF token", { route: req.originalUrl });
        return res.status(403).json({ message: "Missing CSRF token" });
    }

    const token = req.headers.authorization?.split(" ")[1];
    const payload = jwt.verify(token, publicKey, { algorithms: ["RS256"], issuer: ISSUER, audience: AUDIENCE });
    const user = await Users.findById(payload.userId);
    if (!user) {
        console.warn("User not found for CSRF check", { userId: payload.userId });
        return res.status(401).json({ message: "User not found" });
    }

    // Look for the active session that owns this token. (Taking just the FIRST active session
    // rejected valid tokens whenever the user had more than one session, e.g. two devices.)
    const session = user.sessions.find(s => s.expires > new Date() && !s.used && s.csrfToken === csrfToken);
    if (!session) {
        console.warn("Invalid CSRF token", { userId: user._id, route: req.originalUrl });
        return res.status(403).json({ message: "Invalid CSRF token" });
    }
    next();
});

export const protect = asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        console.warn("No token provided", { route: req.originalUrl });
        return res.status(401).json({ message: "Not authorized, no token provided" });
    }

    // Only token problems belong in this try/catch. (It used to also wrap the database work below,
    // so any crash there was reported as "token verification failed" with a 401.)
    let decoded;
    try {
        decoded = jwt.verify(token, publicKey, {
            algorithms: ["RS256"],
            issuer: ISSUER,
            audience: AUDIENCE,
        });
    } catch (error) {
        console.error("Token verification failed", { error: error.message });
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token expired, please refresh or login again" });
        }
        return res.status(401).json({ message: "Not authorized, token verification failed" });
    }

    const user = await Users.findById(decoded.userId).select("-password -sessions -emailVerifyToken");
    if (!user) {
        console.warn("User not found for token", { userId: decoded.userId });
        return res.status(401).json({ message: "User not found" });
    }
    if (!user.isActive) {
        console.warn("Inactive user attempted access", { userId: decoded.userId });
        return res.status(403).json({ message: "User account is inactive" });
    }

    // No user.cleanSessions() here: the user is loaded WITHOUT sessions (see select above), so it
    // crashed on every request and blocked every logged-in route. Sessions are cleaned at login,
    // device verification and token refresh, where the full user is loaded.
    req.user = user;
    console.info("User authenticated", { userId: user.id, route: req.originalUrl });
    next();
});

// ---------- Faster check for busy routes (market data, quotes, trading) ----------
// Same token check as `protect` on every request (signature, issuer, audience, expiry). Only the
// database lookup "does this user exist and is the account active?" is remembered for
// USER_CACHE_MS, because the app calls these routes several times a second and each database trip
// to MongoDB Atlas costs a noticeable fraction of a second. A blocked/deleted account is refused
// within USER_CACHE_MS; the login token itself still expires as usual (15 minutes).
const USER_CACHE_MS = 30_000;
const userCache = new Map(); // userId -> { user, at }

export const protectFast = asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Not authorized, no token provided" });

    let decoded;
    try {
        decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"], issuer: ISSUER, audience: AUDIENCE });
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token expired, please refresh or login again" });
        }
        console.error("Token verification failed", { error: error.message });
        return res.status(401).json({ message: "Not authorized, token verification failed" });
    }

    const cached = userCache.get(decoded.userId);
    let user = cached && Date.now() - cached.at < USER_CACHE_MS ? cached.user : null;
    if (!user) {
        user = await Users.findById(decoded.userId).select("-password -sessions -emailVerifyToken");
        if (!user) {
            userCache.delete(decoded.userId);
            return res.status(401).json({ message: "User not found" });
        }
        userCache.set(decoded.userId, { user, at: Date.now() });
    }
    if (!user.isActive) return res.status(403).json({ message: "User account is inactive" });

    req.user = user;
    next();
});

export const requireRole = (roles) => {
    return asyncHandler(async (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            console.warn("Insufficient permissions", { userId: req.user?.id, role: req.user?.role, requiredRoles: roles });
            return res.status(403).json({ message: `Forbidden: requires one of ${roles.join(", ")} role` });
        }
        console.info("Role check passed", { userId: req.user.id, role: req.user.role, route: req.originalUrl });
        next();
    });
};
// HTTPS enforcement (in app.js)