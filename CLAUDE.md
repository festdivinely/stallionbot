# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project
React Native (Expo) mobile app + Node.js backend that trades on the Deriv API. TypeScript everywhere, `strict` mode on.

## Layout (planned)
- `apps/mobile` — Expo app
- `server/src/api` — backend HTTP API for the app
- `server/src/deriv` — Deriv REST + WebSocket clients
- `server/src/bot` — trading logic
- `server/src/risk` — risk checks
- `packages/shared` — types/code shared by app and server

## Rules
- Use ONLY the new Deriv API docs at developers.deriv.com: REST for OTP, WebSocket for trading. Don't use legacy API docs or examples.
- DEMO account only, until the user explicitly says otherwise.
- Never hardcode tokens or App IDs. Read them from `.env`, and keep `.env` in `.gitignore`.
- Every Deriv connection must send pings and reconnect automatically.
- Every trade must pass through `server/src/risk` before it executes. Nothing may bypass it.

## Working with the user
The user is learning. After each change, briefly explain what you did and why.
