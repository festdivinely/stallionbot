// Deriv REST API (developers.deriv.com): list accounts and get a one-time
// password (OTP) URL for opening the trading WebSocket of a demo or real account.

import { config } from "../config.js";

const BASE_URL = "https://api.derivws.com/trading/v1/options";

export interface DerivAccount {
  account_id: string;
  balance: string;
  currency: string;
  group: string;
  status: string;
  account_type: "demo" | "real";
}

interface ApiError {
  status: number;
  code: string;
  message: string;
}

async function request<T>(method: "GET" | "POST", path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      // Required when authenticating with a Personal Access Token.
      "Deriv-App-ID": config.appId,
    },
  });

  const body = (await res.json().catch(() => ({}))) as { data?: T; errors?: ApiError[] };
  if (!res.ok || body.data === undefined) {
    const reason = body.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") ?? "no details";
    throw new Error(`Deriv ${method} ${path} failed (HTTP ${res.status}) - ${reason}`);
  }
  return body.data;
}

export function getAccounts(): Promise<DerivAccount[]> {
  return request<DerivAccount[]>("GET", "/accounts");
}

export type AccountType = "demo" | "real";

/** Thrown when the token has no active account of the requested type (e.g. no real account yet). */
export class NoAccountError extends Error {
  readonly code = "NO_ACCOUNT";
}

/**
 * The account of the given type to use: a demo account only ever for "demo", a real one only
 * ever for "real". DERIV_ACCOUNT_ID / DERIV_REAL_ACCOUNT_ID can pin a specific one.
 */
export async function getAccountId(type: AccountType): Promise<string> {
  return pickAccount(await getAccounts(), type).account_id;
}

/** Same choice as getAccountId(), from an account list the caller already has (no web request). */
export function pickAccount(accounts: DerivAccount[], type: AccountType): DerivAccount {
  const ofType = accounts.filter((a) => a.account_type === type && a.status === "active");
  const pinned = type === "demo" ? config.accountId : config.realAccountId;

  if (pinned) {
    const match = ofType.find((a) => a.account_id === pinned);
    if (!match) {
      throw new Error(`${type === "demo" ? "DERIV_ACCOUNT_ID" : "DERIV_REAL_ACCOUNT_ID"} ${pinned} is not an active ${type} account`);
    }
    return match;
  }

  const first = ofType[0];
  if (!first) throw new NoAccountError(`No active ${type} account found on this token`);
  return first;
}

/** The demo account (market data and demo trading). */
export const getDemoAccountId = () => getAccountId("demo");

/**
 * Asks Deriv for a fresh WebSocket URL with an OTP in it.
 * The OTP is single-use and expires after 120 seconds, so call this right before connecting.
 */
export async function getWebSocketUrl(accountId: string, type: AccountType): Promise<string> {
  const { url } = await request<{ url: string }>("POST", `/accounts/${encodeURIComponent(accountId)}/otp`);

  // Safety net: the URL must be for exactly the account type that was asked for, so a demo
  // connection can never end up on a real-money account (or the other way round).
  if (new URL(url).pathname !== `/trading/v1/options/ws/${type}`) {
    throw new Error(`OTP URL is not for the ${type} WebSocket - refusing to connect`);
  }
  return url;
}
