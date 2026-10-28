// Deriv WebSockets shared by the whole server, one per account type:
//  - "demo": market data (prices, asset lists, quotes) and demo trading. Always connected.
//  - "real": real-money trading only. Connected the first time it is needed, and only if the
//            token has an active real account (see hasAccount()).
// request() sends a message on one of them and waits for the reply with the same req_id.
// The sockets themselves ping and reconnect (see socket.ts).

import { DerivSocket, type DerivMessage } from "./socket.js";
import { getAccounts, pickAccount, type AccountType, type DerivAccount } from "./rest.js";

const REQUEST_TIMEOUT_MS = 15_000;
// Accounts rarely change (a new real account appears within a minute)
const ACCOUNTS_TTL_MS = 60_000;

interface Shared {
  socket: DerivSocket;
  isOpen: boolean;
  waiting: Map<number, (msg: DerivMessage) => void>;
  openWaiters: (() => void)[];
}

const shared: Partial<Record<AccountType, Shared>> = {};

/** The shared socket for this account type, connecting it on first use. */
export function getSharedSocket(type: AccountType = "demo"): DerivSocket {
  const existing = shared[type];
  if (existing) return existing.socket;
  const s: Shared = { socket: new DerivSocket(type), isOpen: false, waiting: new Map(), openWaiters: [] };
  shared[type] = s;
  s.socket.onOpen(() => {
    s.isOpen = true;
    s.openWaiters.splice(0).forEach((resolve) => resolve());
  });
  s.socket.onMessage((msg) => {
    if (msg.req_id === undefined) return;
    const resolve = s.waiting.get(msg.req_id);
    if (resolve) {
      s.waiting.delete(msg.req_id);
      resolve(msg);
    }
  });
  void s.socket.connect();
  return s.socket;
}

function whenOpen(type: AccountType): Promise<void> {
  getSharedSocket(type);
  const s = shared[type]!;
  return s.isOpen ? Promise.resolve() : new Promise((resolve) => s.openWaiters.push(resolve));
}

/**
 * Sends one request on the given account's socket and resolves with Deriv's reply. Rejects on
 * timeout or if the socket is down; a Deriv error reply (msg.error) is returned as-is.
 */
export async function request(payload: Record<string, unknown>, type: AccountType = "demo", retried = false): Promise<DerivMessage> {
  await Promise.race([
    whenOpen(type),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Deriv ${type} connection not ready`)), REQUEST_TIMEOUT_MS)),
  ]);
  const s = shared[type]!;
  let reqId: number;
  try {
    reqId = s.socket.send(payload);
  } catch (err) {
    // send() only throws when the socket is not open: it dropped and is reconnecting (usually
    // within a second or two). Wait for the reconnect and try once more instead of failing.
    s.isOpen = false;
    if (retried) throw err;
    return request(payload, type, true);
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      s.waiting.delete(reqId);
      reject(new Error(`Deriv did not answer ${Object.keys(payload)[0]} in time`));
    }, REQUEST_TIMEOUT_MS);
    s.waiting.set(reqId, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });
}

// ---------- Accounts ----------
// The account list comes from Deriv's website (REST), which is slow (~0.5-1 s) and rate-limited,
// so it is fetched rarely and remembered. Balances don't come from it at all: each connected
// account's socket subscribes to `balance`, and Deriv pushes every change (e.g. right after a buy).

let accountsCache: { at: number; list: DerivAccount[] } | undefined;
let accountsLoading: Promise<DerivAccount[]> | undefined;

/** The token's Deriv accounts, remembered for ACCOUNTS_TTL_MS (one web request shared by all callers). */
export async function listAccounts(): Promise<DerivAccount[]> {
  if (accountsCache && Date.now() - accountsCache.at < ACCOUNTS_TTL_MS) return accountsCache.list;
  accountsLoading ??= getAccounts()
    .then((list) => {
      accountsCache = { at: Date.now(), list };
      return list;
    })
    .catch((err) => {
      // Deriv busy or unreachable: keep using the last known list rather than failing
      if (accountsCache) return accountsCache.list;
      throw err;
    })
    .finally(() => {
      accountsLoading = undefined;
    });
  return accountsLoading;
}

/** The account the app uses for this type, or null when there is none (e.g. no real account yet). */
export async function accountFor(type: AccountType): Promise<DerivAccount | null> {
  try {
    return pickAccount(await listAccounts(), type);
  } catch (err) {
    if ((err as { code?: string }).code === "NO_ACCOUNT") return null;
    throw err;
  }
}

export async function hasAccount(type: AccountType): Promise<boolean> {
  return (await accountFor(type)) !== null;
}

/** Currency of that account (quotes and buys must use the account's own currency). Remembered. */
export async function getAccountCurrency(type: AccountType = "demo"): Promise<string> {
  return (await accountFor(type))?.currency || "USD";
}

// ---------- Live balances ----------

const balances: Partial<Record<AccountType, { balance: number; currency: string }>> = {};
const balanceFeeds = new Set<AccountType>();
const balanceHandlers = new Set<(type: AccountType) => void>();

/** Calls `handler` whenever Deriv pushes a new balance for an account. */
export function onBalanceChange(handler: (type: AccountType) => void): void {
  balanceHandlers.add(handler);
}

/** Subscribes to this account's balance (once): Deriv then pushes every change. */
export function followBalance(type: AccountType): void {
  if (balanceFeeds.has(type)) return;
  balanceFeeds.add(type);
  const s = getSharedSocket(type);
  const subscribe = () => {
    try {
      s.send({ balance: 1, subscribe: 1 });
    } catch {
      // Not connected yet: onOpen subscribes once it is
    }
  };
  // After every (re)connect the subscription is gone, so subscribe again
  s.onOpen(subscribe);
  s.onMessage((msg) => {
    if (msg.msg_type !== "balance" || msg.error) return;
    const b = msg.balance as { balance: number | string; currency: string };
    const value = Number(b.balance);
    if (Number.isFinite(value) && value !== balances[type]?.balance) {
      balances[type] = { balance: value, currency: b.currency };
      for (const handler of balanceHandlers) handler(type);
    }
  });
  if (shared[type]?.isOpen) subscribe();
}

/** The latest balance Deriv pushed for this account, if any yet. */
export function liveBalance(type: AccountType) {
  return balances[type];
}

/** Update the balance right away from a buy reply (balance_after), before Deriv's push arrives. */
export function setBalance(type: AccountType, balance: number, currency: string) {
  if (Number.isFinite(balance)) balances[type] = { balance, currency };
}
