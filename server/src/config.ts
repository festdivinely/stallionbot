// Reads settings from server/.env (loaded by `node --env-file=.env`).
// Fails fast with a clear message so a missing value never causes a confusing error later.

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} in server/.env (see server/.env.example)`);
  }
  return value;
}

export const config = {
  appId: required("DERIV_APP_ID"),
  apiToken: required("DERIV_API_TOKEN"),
  // Optional: pin specific accounts; otherwise the first active one of each type is used.
  // Market data always comes from the demo account. Real trades only happen when the user has
  // picked Real in the app (the user approved real mode on 2026-10-27; the app starts in Demo).
  accountId: process.env.DERIV_ACCOUNT_ID?.trim() || undefined,
  realAccountId: process.env.DERIV_REAL_ACCOUNT_ID?.trim() || undefined,
};
