// Reads settings from server/.env (loaded by `node --env-file=.env`).
// Fails fast with a clear message so a missing value never causes a confusing error later.

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name} in server/.env (see server/.env.example)`);
  }
  return value;
}

const accountType = required("DERIV_ACCOUNT_TYPE");
if (accountType !== "demo") {
  // Project rule: DEMO only until the user explicitly says otherwise.
  throw new Error(`DERIV_ACCOUNT_TYPE must be "demo" (got "${accountType}")`);
}

export const config = {
  appId: required("DERIV_APP_ID"),
  apiToken: required("DERIV_API_TOKEN"),
  accountType: "demo" as const,
  // Optional: pin a specific demo account; otherwise we pick one automatically.
  accountId: process.env.DERIV_ACCOUNT_ID?.trim() || undefined,
};
