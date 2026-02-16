import type { AlpacaCredentials, OptionType } from "@repo/alpaca";

export function parseSymbols(input: string[]): string[] {
  const normalized = input
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.toUpperCase());

  return Array.from(new Set(normalized));
}

export function getCredentials(): AlpacaCredentials {
  const key = process.env.ALPACA_API_KEY;
  const secret = process.env.ALPACA_API_SECRET;

  if (!key || !secret) {
    throw new Error(
      "Missing credentials. Set ALPACA_API_KEY and ALPACA_API_SECRET.",
    );
  }

  return { key, secret };
}

export function parseOptionType(value?: string): OptionType | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (normalized === "call" || normalized === "put") {
    return normalized;
  }

  throw new Error("--type must be 'call' or 'put'.");
}

export function outputJson(payload: unknown, minimal = false): void {
  const json = minimal
    ? JSON.stringify(payload)
    : JSON.stringify(payload, null, 2);
  console.log(json);
}

export function failWithMessage(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
