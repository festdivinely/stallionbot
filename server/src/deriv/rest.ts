// Deriv REST API (developers.deriv.com): list accounts and get a one-time
// password (OTP) URL for opening the trading WebSocket.

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

/** Returns the demo account to use. Never returns a real-money account. */
export async function getDemoAccountId(): Promise<string> {
  const accounts = await getAccounts();
  const demo = accounts.filter((a) => a.account_type === "demo" && a.status === "active");

  if (config.accountId) {
    if (!demo.some((a) => a.account_id === config.accountId)) {
      throw new Error(`DERIV_ACCOUNT_ID ${config.accountId} is not an active demo account`);
    }
    return config.accountId;
  }

  const first = demo[0];
  if (!first) throw new Error("No active demo account found on this token");
  return first.account_id;
}

/**
 * Asks Deriv for a fresh WebSocket URL with an OTP in it.
 * The OTP is single-use and expires after 120 seconds, so call this right before connecting.
 */
export async function getWebSocketUrl(accountId: string): Promise<string> {
  const { url } = await request<{ url: string }>("POST", `/accounts/${encodeURIComponent(accountId)}/otp`);

  // Safety net: refuse anything that is not the demo endpoint.
  if (new URL(url).pathname !== "/trading/v1/options/ws/demo") {
    throw new Error("OTP URL is not for the demo WebSocket - refusing to connect");
  }
  return url;
}
