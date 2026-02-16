import { createIbkrClient } from "@repo/ibkr";
import type { Command } from "commander";

type IbkrCheckPayload = {
  accountId: string;
  timestamp: string;
  balance: {
    currency: unknown;
    netLiquidation: unknown;
    cashBalance: unknown;
    availableFunds: unknown;
  };
  note?: string;
};

type IbkrCheckOptions = {
  accountId?: string;
  baseUrl?: string;
  timeout?: number;
  verifyTls?: boolean;
  minimal?: boolean;
};

export function registerIbkrCommand(program: Command): void {
  const ibkr = program
    .command("ibkr")
    .description("Interactive Brokers integration checks");

  ibkr
    .command("check")
    .description(
      "Verify gateway auth and return a quick account balance snapshot",
    )
    .option("--account-id <id>", "IBKR account id (for example U1234567)")
    .option("--base-url <url>", "Client Portal Gateway base URL")
    .option(
      "--timeout <ms>",
      "HTTP timeout in milliseconds",
      parseTimeout,
      10_000,
    )
    .option(
      "--verify-tls",
      "Verify TLS certificates when talking to gateway",
      false,
    )
    .option("--minimal", "Output minified JSON", false)
    .action(async (options: IbkrCheckOptions) => {
      try {
        const client = createIbkrClient({
          baseUrl: options.baseUrl,
          timeoutMs: options.timeout,
          verifyTls: options.verifyTls,
        });

        await client.checkAuth();
        const accounts = await client.getAccounts();
        const selectedAccount = options.accountId ?? pickFirstAccount(accounts);
        const summary = await client.getAccountSummary(selectedAccount);

        const summaryFields = lowerCaseEntries(summary);

        const payload: IbkrCheckPayload = {
          accountId: selectedAccount,
          timestamp: new Date().toISOString(),
          balance: {
            currency: getField(summaryFields, [
              "currency",
              "baseCurrency",
              "base_currency",
            ]),
            netLiquidation: getField(summaryFields, [
              "NetLiquidation",
              "net_liquidation",
              "netLiquidation",
            ]),
            cashBalance: getField(summaryFields, [
              "TotalCashValue",
              "cash_balance",
              "cashBalance",
            ]),
            availableFunds: getField(summaryFields, [
              "AvailableFunds",
              "available_funds",
              "availableFunds",
            ]),
          },
          note:
            !options.accountId && accounts.length > 1
              ? "Multiple accounts found; using the first. Use --account-id to choose."
              : undefined,
        };

        outputJson(payload, options.minimal ?? false);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exit(1);
      }
    });
}

function outputJson(payload: unknown, minimal = false): void {
  const json = minimal
    ? JSON.stringify(payload)
    : JSON.stringify(payload, null, 2);
  console.log(json);
}

function parseTimeout(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error("--timeout must be a positive integer.");
  }
  return parsed;
}

function pickFirstAccount(accounts: string[]): string {
  const first = accounts[0];
  if (!first) {
    throw new Error("No accounts found in IBKR response.");
  }
  return first;
}

function lowerCaseEntries(
  summary: Record<string, unknown>,
): Map<string, unknown> {
  const lowerMap = new Map<string, unknown>();
  for (const [key, value] of Object.entries(summary)) {
    lowerMap.set(key.toLowerCase(), value);
  }

  return lowerMap;
}

function getField(lowerMap: Map<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const lowered = key.toLowerCase();
    if (lowerMap.has(lowered)) {
      return lowerMap.get(lowered);
    }
  }

  return null;
}
