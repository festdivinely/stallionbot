// One Deriv demo WebSocket shared by the whole server (live prices, asset lists, quotes), plus a
// request() helper that sends a message and waits for the reply with the same req_id.
// The socket itself pings and reconnects (see socket.ts).

import { DerivSocket, type DerivMessage } from "./socket.js";
import { getAccounts, getDemoAccountId } from "./rest.js";

const REQUEST_TIMEOUT_MS = 15_000;

let socket: DerivSocket | undefined;
let isOpen = false;
const waiting = new Map<number, (msg: DerivMessage) => void>();
const openWaiters: (() => void)[] = [];

/** The shared socket, connecting it on first use. */
export function getSharedSocket(): DerivSocket {
  if (socket) return socket;
  const s = new DerivSocket();
  socket = s;
  s.onOpen(() => {
    isOpen = true;
    openWaiters.splice(0).forEach((resolve) => resolve());
  });
  s.onMessage((msg) => {
    if (msg.req_id === undefined) return;
    const resolve = waiting.get(msg.req_id);
    if (resolve) {
      waiting.delete(msg.req_id);
      resolve(msg);
    }
  });
  void s.connect();
  return s;
}

function whenOpen(): Promise<void> {
  getSharedSocket();
  return isOpen ? Promise.resolve() : new Promise((resolve) => openWaiters.push(resolve));
}

/**
 * Sends one request and resolves with Deriv's reply. Rejects on timeout or if the socket is
 * down; a Deriv error reply (msg.error) is returned as-is for the caller to report.
 */
export async function request(payload: Record<string, unknown>): Promise<DerivMessage> {
  await Promise.race([
    whenOpen(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Deriv connection not ready")), REQUEST_TIMEOUT_MS)),
  ]);
  return new Promise((resolve, reject) => {
    let reqId: number;
    try {
      reqId = getSharedSocket().send(payload);
    } catch (err) {
      isOpen = false; // send() only throws when the socket is not open
      reject(err);
      return;
    }
    const timer = setTimeout(() => {
      waiting.delete(reqId);
      reject(new Error(`Deriv did not answer ${Object.keys(payload)[0]} in time`));
    }, REQUEST_TIMEOUT_MS);
    waiting.set(reqId, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });
}

let currency: Promise<string> | undefined;

/** Currency of the demo account (quotes must be asked in the account's own currency). */
export function getAccountCurrency(): Promise<string> {
  currency ??= (async () => {
    const id = await getDemoAccountId();
    const account = (await getAccounts()).find((a) => a.account_id === id);
    return account?.currency || "USD";
  })().catch((err) => {
    currency = undefined; // try again next time
    throw err;
  });
  return currency;
}
