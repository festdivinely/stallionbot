# stallionbot

React Native (Expo) app + Node.js backend that trades on the Deriv API (demo account only).

## Layout
- `apps/mobile` - Expo app (started from trading-app-new, Expo SDK 58)
- `server/src/api` - HTTP API the app talks to: login, 2FA, bots (started from nodejs-bot-backend)
- `server/src/deriv` - Deriv REST (OTP) + WebSocket clients
- `server/src/bot`, `server/src/risk` - trading logic and risk checks (to build)

## Setup
Each part has its own `.env`, which is never committed. Copy the example and fill in your values:
- `server/.env.example` -> `server/.env` (Deriv App ID + token, MongoDB, JWT keys, email...)
- `apps/mobile/.env.example` -> `apps/mobile/.env` (`EXPO_PUBLIC_API_URL`, the backend address)

## Run
```bash
cd server && npm install && npm run dev      # HTTP API on PORT (default 3000)
cd server && npm run deriv:ticks             # Deriv demo tick stream
cd apps/mobile && npm install && npx expo start -c
```
