import type { AlpacaCredentials } from "@repo/alpaca";

export function readAlpacaCredentials(): AlpacaCredentials | null {
  const key = process.env.ALPACA_API_KEY;
  const secret = process.env.ALPACA_API_SECRET;

  if (!key || !secret) {
    return null;
  }

  return { key, secret };
}
