# Stallion Trader: where everything is, and how to host it and build the APK

## 1. The two parts

| Part | Folder | What it does | Runs where |
|---|---|---|---|
| **App** | `apps/mobile` | Expo (React Native) app: screens, charts, Demo/Real switch, Split Money | On the phone (APK) |
| **Server** | `server` | Node.js backend: login, emails, Deriv connection, trading, risk checks, Split Money rules | On a host (always on) |

The app never talks to Deriv directly. It only talks to the server, and the server talks to Deriv.

```
Phone (APK) ──HTTPS──▶ Server ──WebSocket──▶ Deriv (trading)
                        │ ├──REST──────────▶ Deriv (accounts + one-time password)
                        │ ├──────────────────▶ MongoDB Atlas (users, sessions, Split Money pots)
                        │ ├──────────────────▶ Gmail SMTP (emails)
                        │ └──────────────────▶ Cloudinary (profile pictures)
```

## 2. Server map (`server/src`)

| Folder / file | Job |
|---|---|
| `api/server.js`, `api/app.js` | Starts the HTTP server; security headers, body limits, rate limits, the database-command guard |
| `api/routes/authRoutes.js` + `controllers/authController.js` | Sign-up, login, device check, email codes, password reset, token refresh, profile |
| `api/routes/marketRoutes.js` | Prices, assets, trade types, quotes, accounts, buy, sell, live trade updates |
| `api/routes/strategyRoutes.js` | Split Money: setup, start/stop, lend, repay, adjust, reset |
| `api/routes/botRoutes.js` | Bot templates (bots themselves aren't built yet) |
| `api/middleware/authMiddleware.js` | Login checks (`protect`, `protectFast`), admin role, **`requireTrader`** (who may trade) |
| `api/utility/*Email.js` | **All emails** (see section 4) |
| `deriv/` | Deriv connection: `rest.ts` (accounts, one-time password), `socket.ts` (WebSocket with pings + auto-reconnect), `shared.ts` (one socket per account, balances) |
| `market/` | `catalog.ts` (assets, trade types, quotes), `tickFeed.ts` (live prices), `trading.ts` (buy, follow, sell) |
| `risk/index.ts` | **Every buy passes here**: stake, open trades, trades per day, daily loss (demo and real separately) |
| `risk/splitMoney.ts`, `risk/splitMoneyStore.ts` | Split Money rules, saved in MongoDB |
| `scripts/test-split-money.ts` | Rule tests: `npx tsx scripts/test-split-money.ts` |

## 3. App map (`apps/mobile`)

| Folder | Job |
|---|---|
| `app/` | Screens (Expo Router): `(auth)` login/sign-up, `(tabs)` home, `deriv/` hub, Options, Split Money, strategies |
| `components/deriv/` | Contract card, pot bar, account switch, asset picker, explanations |
| `hooks/` | Talking to the server: `useDerivMarket.ts`, `useSplitMoney.ts`, `useLiveTicks.ts` |
| `apis/authApi.ts` | The one HTTP client: adds the login token, refreshes it, never repeats buys/sells/loans |
| `store/` | App state: login, theme, Demo/Real |
| `constants/` | Trade-type explanations, strategies, colours, fonts |

## 4. Email

Emails are sent **by the Node.js server itself**, through **Gmail** (`smtp.gmail.com`, port 465, `nodemailer`).
There is no separate email server. The files are in `server/src/api/utility/`:

- `email.js`: sign-up verification code
- `deviceVerifyEmail.js`: new-device login code
- `passwordResetEmail.js`: password reset code
- `suspiciousEmail.js`: suspicious-login alert

Settings in `server/.env`: `EMAIL_SENDER` (the Gmail address) and `EMAIL_PASSWORD` (a Gmail **app password**).
Gmail allows about 500 emails a day, which is plenty for personal use.

## 5. Secrets and settings

- **Server:** everything is in `server/.env`. The list of names is in `server/.env.example`. Never commit `.env`.
  - `TRADER_EMAILS`: **only these app accounts may trade**. The server uses one Deriv token (yours), and anyone can sign up to the app, so without this list a stranger could trade with your money.
  - `NODE_ENV=production` on the host (hides error details).
  - `INTERNAL_API_KEY`: only needed later, for the bot runner.
- **App:** `apps/mobile/.env` has only `EXPO_PUBLIC_API_URL` (the server's address). It is **built into the APK**, so it must be the hosted HTTPS address before building.

## 6. Hosting the server (do this BEFORE building the APK)

1. Pick a host that runs Node.js **22 or newer** (this PC uses 24) all the time (no sleeping), with **one** instance. Trades in progress, risk counters and live updates are kept in the server's memory, so two copies would disagree.
2. Start command: `npm install` then `npm start` (in `server/`).
3. Copy every value from `server/.env` into the host's environment settings, and set `NODE_ENV=production`.
4. In MongoDB Atlas → Network Access, allow the host's IP address.
5. Check: `https://<your-host>/health` shows OK. Log in from the app. Ask for a password-reset code to check that email works (some hosts block email ports).
6. **Free plans that sleep (Render free):** the server keeps itself awake by visiting its own
   `/health` every 10 minutes (`src/api/utils/keepAlive.js`; on Render it finds its address by
   itself, elsewhere set `KEEP_ALIVE_URL`). Render's free plan gives 750 hours a month per account,
   enough for ONE service running all month (a month has at most 744 hours). A second free service
   would use up the hours before the month ends. Backup: a free pinger such as cron-job.org calling
   `/health` every 10 minutes.
7. Restarting the server forgets open-trade cards and today's risk counters. Your Deriv trades themselves are not affected, and Split Money pots are saved.

## 7. Building the APK

1. Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to the hosted HTTPS address.
2. Build either way:
   - **On this PC (no account needed):** `npx expo prebuild -p android`, then `android\gradlew assembleRelease`. Uses the Android SDK and JDK 17 already installed.
   - **With Expo's build service (EAS):** you sign in to your Expo account yourself (`npx eas login`), then `npx eas build -p android --profile preview`.
3. Install the `.apk` on your phone (allow "install unknown apps").

## 8. Security checklist (checked on 2026-10-28)

- [x] No secrets in git; `.env`, keys and keystores are ignored
- [x] Passwords hashed; login tokens RS256 (15 min access, 15 days refresh, rotated)
- [x] Only `TRADER_EMAILS` accounts can see the balance, quote, trade or use Split Money
- [x] Every buy passes `risk/index.ts` (plus Split Money when it's on); buys, sells and loans are never retried automatically
- [x] Requests containing database commands (`$ne`, `$gt`…) are refused
- [x] Bot progress route needs a secret key; public bot list limited to 50 per page
- [x] Rate limits on login, sign-up, codes, quotes, trades
- [x] Email library updated (nodemailer 10.2.1); Gmail login checked
- [ ] Known and accepted: warnings in Expo's build tools (not inside the APK), and an old `ip-address` inside the country-lookup package (its risky part isn't used)
