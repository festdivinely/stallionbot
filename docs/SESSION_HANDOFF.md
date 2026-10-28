# Stallion Trader: session handoff (2026-10-28)

Paste this into a new session so it starts on the same page. Project rules are in `CLAUDE.md`.

## What the project is
- **Stallion Trader**: a multi-broker trading app. React Native (Expo SDK 58) app in `apps/mobile`, Node.js/Express backend in `server` (TypeScript, `strict`). GitHub: `festdivinely/stallionbot`, branch `app-and-backend-setup`.
- Deriv is the only broker so far (ExpertOption listed as "Coming soon"; it has no official trading API).
- Deriv: **only the new API** at developers.deriv.com (REST for accounts/OTP, WebSocket for everything else). New field names: `underlying_symbol`, prices/barriers arrive as **text**.

## How the user likes to work
- The user is learning: explain each change simply (what and why). Avoid jargon ("PR", "pull request" confused them).
- **"Keep control"**: Claude starts/stops/fixes the emulator, backend and Expo; the user reports problems.
- When the user sends pictures/videos in parts, **wait until they say "done"** before analysing or building.
- Claude must **never place trades itself** (demo or real). The user taps Buy; Claude verifies.
- Never type the user's password. Never print `.env` values.

## Running it (Windows PC, virtual phone)
- Terminal tabs (Claude app Terminal panel): **Phone**, **Backend**, **Expo**.
- Phone: `& 'C:\Users\HP\Android\Sdk\emulator\emulator.exe' -avd QuantumPhone -no-boot-anim -no-metrics -netdelay none -netspeed full -gpu host -feature -ForceSwiftshader`
  (the `-feature -ForceSwiftshader` override makes it use the Intel HD 4400; without it: constant "System UI isn't responding").
- Backend: `npm start` in `server` (port 3000).
- Expo: `$env:ANDROID_HOME = 'C:\Users\HP\Android\Sdk'; npx expo start --android --offline` in `apps/mobile` (port 8081). First load after a restart takes ~2 min.
- adb: `C:\Users\HP\Android\Sdk\platform-tools\adb.exe`. App URL in Expo Go: `exp://10.0.2.2:8081`. If Expo Go sticks on "downloading", force-stop it and start once.
- App talks to the backend at `EXPO_PUBLIC_API_URL=http://192.168.238.10:3000` (`apps/mobile/.env`); check the PC's Wi-Fi IP still matches after restarts.
- Screenshots: `adb shell screencap -p /sdcard/a.png` then `adb pull`.
- Videos: no ffmpeg; Claude extracted frames with a small local Node page (video seek + canvas) in the built-in browser.

## What is built
**App (apps/mobile)**
- Welcome slides, login (Remember me = email only; Android password-manager hints; fingerprint login via `utils/quickLogin.ts`), sign-up, device/email verification with "use code from clipboard" banner, themed alerts, theme picker (user now uses a dark gold theme).
- Home: bots grouped by broker (empty state), Brokers list; sidebar with Brokers.
- Deriv hub (`app/deriv/index.tsx`): **Demo | Real switch with balances** (`components/deriv/AccountSwitch.tsx`, `store/accountStore.ts`; always starts in Demo; Real asks to confirm; "Not connected" while no real account), live tickers, Build a bot (placeholder) / Trade manually (market list: Options available; Forex, Stocks, Commodities, Crypto "Soon"; 4 ready-made strategy screens).
- **Options screen** (`app/deriv/options.tsx`, SmartTrader-style): live chart; Market sheet (all ~89 Deriv options assets, one long list, tabs follow scroll, search, opens at selected asset, closes on tap outside); Trade types per asset; settings per trade type (Duration **or End time**, barriers, digits, multipliers, growth rate, etc.); live Deriv quotes on buttons; **real buying**; compact Demo/Real pill; red REAL bar + per-trade confirmation in Real.
- **Live contract card** (`components/deriv/ContractCard.tsx`) for every options trade type (barrier, range, Asians, Reset, High/Low Ticks, Only Ups/Downs charts; digit trades as Deriv's digit strip with a sliding card). Shows only for the trade just bought; ✕ hides it; leaving the screen or changing market/trade type/account hides it too. "How it works" explanations (`constants/tradeExplanations.ts`) under the buy buttons; "Other trades" rows at the bottom.
- **Split Money strategy** (`app/deriv/split-money.tsx`, `hooks/useSplitMoney.ts`, `components/deriv/PotBar.tsx`): money split into sections + bank layers; when on, the Options screen shows a pot bar and every buy sends `potId`.

**Backend (server)**
- `src/deriv/shared.ts`: one WebSocket per account type (demo always; real only if a real account exists), request/reply helper with retry after a reconnect, remembered account list (60 s), live balances via `balance` subscription.
- `src/deriv/rest.ts`: accounts + OTP; the OTP URL must match the requested type (`/ws/demo` or `/ws/real`).
- `src/market/catalog.ts`: assets (`active_symbols`), trade types per asset (`contracts_for`), quotes (`proposal`, never buys).
- `src/market/trading.ts`: buy → follow contract (`proposal_open_contract`, records tick path) → sell; per account type.
- `src/risk/splitMoney.ts` (+ `splitMoneyStore.ts`, MongoDB): Split Money rules (stake ≤ pot and ≤ max % of it, empty pot locked, loans only bank → layer below or section → section, loans due after N hours then auto-collected, cool-down, daily loss cap, pause when the Deriv balance < pots). Saved in the database; open strategy trades are re-followed after a restart. Routes in `src/api/routes/strategyRoutes.js` (`/api/strategy/split...`). Rule tests: `npx tsx scripts/test-split-money.ts` in `server`.
- Live updates: `/trades?since=N` long-polls (answers the moment a tick/result/balance changes); buys use `subscribe: 1`.
- `src/risk/index.ts`: **every buy passes here**. Limits per user per day, separate for demo/real, from `server/.env` (`RISK_*`, `RISK_REAL_*`; real defaults: stake 10, 3 open, 50/day, loss 50).
- `src/api/routes/marketRoutes.js`: `/ticks`, `/assets`, `/assets/:symbol/trade-types`, `/quote`, `/accounts`, `/trade?account=`, `/trades?account=`, `/trades/:id/sell?account=` (only the exact value `real` selects real money). Uses `protectFast` (token checked each request, user lookup cached 30 s).
- Login/session fixes: CSRF token saved; single shared token refresh; only 401/403 logs out; refresh replay grace (2 min); device ID kept on logout; secrets redacted from logs.

## State right now
- Last commit: `f66ad77` (pushed). **20 files changed since, not committed**: risk module, trading, Demo/Real, contract card, End time, speed fixes, auth fixes, `CLAUDE.md` rule update.
- A pull request to `main` was never created (no `gh` on the PC; GitHub sign-in needed). User said to leave it.
- The token only has a **demo** account (`DOT94920931`); a real options account must be opened on Deriv by the user.
- Trades and risk counters live in server memory: lost when the backend restarts.
- Speed: quotes ~0.5-0.6 s, refresh <0.1 s after the fixes; the user hasn't yet confirmed buy speed (buy log now includes `ms`).

## Next steps
1. User to place trades and confirm the speed; read `[trade] bought ... ms` in the backend log.
2. Progress cards for the remaining trade types (user will send pictures/videos per type): Ends Between/Outside, Stays Between/Goes Outside, digits (Matches/Differs, Even/Odd, Over/Under), Accumulators, Multipliers, Turbos, Vanillas, Asians, Reset, High/Low Ticks, Only Ups/Downs.
3. Commit the uncommitted work when the user asks.
4. Later ideas: save trades and risk counters in the database; per-user Deriv accounts (OAuth) before others use the app; bot builder; Explore/Search tabs are still placeholders; the Render deployment runs old backend code.
