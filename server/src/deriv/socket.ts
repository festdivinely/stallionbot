// A Deriv WebSocket connection that keeps itself alive:
// - sends a ping every 30s (Deriv drops idle connections after ~2 minutes)
// - treats 60s of silence as a dead connection
// - reconnects automatically with backoff, using a fresh OTP each time

import { getDemoAccountId, getWebSocketUrl } from "./rest.js";

const PING_INTERVAL_MS = 30_000;
const SILENCE_TIMEOUT_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;

/** Any message Deriv sends back. Every response has msg_type; failed requests also have error. */
export interface DerivMessage {
  msg_type: string;
  req_id?: number;
  error?: { code: string; message: string };
  [key: string]: unknown;
}

type MessageHandler = (msg: DerivMessage) => void;
type OpenHandler = () => void;

export class DerivSocket {
  private ws: WebSocket | undefined;
  private accountId: string | undefined;
  private nextReqId = 1;
  private attempt = 0;
  private stopped = false;
  private pingTimer: NodeJS.Timeout | undefined;
  private silenceTimer: NodeJS.Timeout | undefined;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private readonly messageHandlers: MessageHandler[] = [];
  private readonly openHandlers: OpenHandler[] = [];

  /** Called for every message from Deriv. */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /** Called after every (re)connect - put subscriptions here so they are restored. */
  onOpen(handler: OpenHandler): void {
    this.openHandlers.push(handler);
  }

  async connect(): Promise<void> {
    this.stopped = false;
    try {
      this.accountId ??= await getDemoAccountId();
      const url = await getWebSocketUrl(this.accountId);
      this.open(url);
    } catch (err) {
      console.error(`[deriv] connect failed: ${(err as Error).message}`);
      this.scheduleReconnect();
    }
  }

  /** Sends a request and returns the req_id used, so replies can be matched. */
  send(payload: Record<string, unknown>): number {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error("Deriv WebSocket is not open");
    }
    const req_id = this.nextReqId++;
    this.ws.send(JSON.stringify({ ...payload, req_id }));
    return req_id;
  }

  /** Closes for good (no reconnect). */
  close(): void {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    this.stopTimers();
    this.ws?.close();
  }

  private open(url: string): void {
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      console.log(`[deriv] connected (demo account ${this.accountId})`);
      this.attempt = 0;
      this.startTimers();
      for (const handler of this.openHandlers) handler();
    });

    ws.addEventListener("message", (event) => {
      this.resetSilenceTimer();
      let msg: DerivMessage;
      try {
        msg = JSON.parse(String(event.data)) as DerivMessage;
      } catch {
        console.error("[deriv] received non-JSON message");
        return;
      }
      for (const handler of this.messageHandlers) handler(msg);
    });

    ws.addEventListener("error", () => {
      // A "close" event always follows, which handles the reconnect.
      console.error("[deriv] socket error");
    });

    ws.addEventListener("close", (event) => {
      this.stopTimers();
      if (this.ws !== ws) return; // an old socket closing late; ignore it
      this.ws = undefined;
      if (!this.stopped) {
        console.warn(`[deriv] disconnected (code ${event.code})`);
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    // 1s, 2s, 4s, 8s ... up to 30s
    const delay = Math.min(1000 * 2 ** this.attempt, MAX_BACKOFF_MS);
    this.attempt++;
    console.log(`[deriv] reconnecting in ${delay / 1000}s...`);
    this.reconnectTimer = setTimeout(() => void this.connect(), delay);
  }

  private startTimers(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.send({ ping: 1 });
    }, PING_INTERVAL_MS);
    this.resetSilenceTimer();
  }

  private resetSilenceTimer(): void {
    clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      console.warn("[deriv] no data for 60s - assuming connection is dead");
      this.ws?.close();
    }, SILENCE_TIMEOUT_MS);
  }

  private stopTimers(): void {
    clearInterval(this.pingTimer);
    clearTimeout(this.silenceTimer);
  }
}
