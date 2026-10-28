// Saving and loading the Split Money strategy (server/src/risk/splitMoney.ts) in MongoDB: one
// document per user and account (demo / real), holding the whole strategy state.
import mongoose from "mongoose";
import type { AccountType } from "./index.js";

const schema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    account: { type: String, enum: ["demo", "real"], required: true },
    // The strategy state as splitMoney.ts keeps it (settings, pots, loans, open trades, history)
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true, minimize: false }
);
schema.index({ userId: 1, account: 1 }, { unique: true });

// (Reuse the model if this file is loaded twice, e.g. by a dev reload)
const SplitMoney = (mongoose.models.SplitMoney as mongoose.Model<mongoose.InferSchemaType<typeof schema>> | undefined) ?? mongoose.model("SplitMoney", schema);

export const dbReady = () => mongoose.connection.readyState === 1;

export async function loadState<T>(userId: string, account: AccountType): Promise<T | null> {
  const doc = await SplitMoney.findOne({ userId, account }).lean<{ data: T }>();
  return doc?.data ?? null;
}

/** Every strategy that may need background work (open trades, loans), for after a restart. */
export async function loadAllStates<T>(): Promise<{ userId: string; account: AccountType; data: T }[]> {
  return SplitMoney.find({}).lean<{ userId: string; account: AccountType; data: T }[]>();
}

export async function saveState(userId: string, account: AccountType, data: unknown): Promise<void> {
  await SplitMoney.updateOne({ userId, account }, { $set: { data } }, { upsert: true });
}

export async function deleteState(userId: string, account: AccountType): Promise<void> {
  await SplitMoney.deleteOne({ userId, account });
}
