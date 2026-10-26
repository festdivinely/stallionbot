// Entry point: stream live ticks for one volatility index from the Deriv demo WebSocket.
// Run with: npm run deriv:ticks

import { DerivSocket, type DerivMessage } from "./socket.js";

const SYMBOL = "R_100"; // Volatility 100 Index

interface TickMessage extends DerivMessage {
  msg_type: "tick";
  tick: { symbol: string; quote: number; epoch: number };
}

const socket = new DerivSocket();

// Runs on the first connect AND after every reconnect, so the stream always comes back.
socket.onOpen(() => {
  socket.send({ ticks: SYMBOL, subscribe: 1 });
});

socket.onMessage((msg) => {
  if (msg.error) {
    console.error(`[deriv] ${msg.msg_type} error ${msg.error.code}: ${msg.error.message}`);
    return;
  }
  if (msg.msg_type === "tick") {
    const { tick } = msg as TickMessage;
    const time = new Date(tick.epoch * 1000).toLocaleTimeString();
    console.log(`${time}  ${tick.symbol}  ${tick.quote}`);
  }
  // "ping" replies (pongs) and other messages are ignored here.
});

process.on("SIGINT", () => {
  console.log("\n[deriv] shutting down");
  socket.close();
  process.exit(0);
});

void socket.connect();
