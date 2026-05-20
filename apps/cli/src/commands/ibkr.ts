import { writeFileSync } from "node:fs";
import { createIbkrPortfolioService } from "@repo/ibkr";
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
  verifyTls?: boolean;
  minimal?: boolean;
};

type IbkrPositionsOptions = {
  accountId?: string;
  baseUrl?: string;
  verifyTls?: boolean;
  output?: string;
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
      "--verify-tls",
      "Verify TLS certificates when talking to gateway",
      false,
    )
    .option("--minimal", "Output minified JSON", false)
    .action(async (options: IbkrCheckOptions) => {
      try {
        const service = createIbkrPortfolioService({
          baseUrl: options.baseUrl,
          verifyTls: options.verifyTls,
        });
        const result = await service.snapshot({ accountId: options.accountId });
        if (!result.ok) {
          throw new Error(result.message);
        }

        const payload: IbkrCheckPayload = {
          accountId: result.data.accountId,
          timestamp: result.data.generatedAt,
          balance: result.data.balance,
          note: result.warnings?.join(" "),
        };

        outputJson(payload, options.minimal ?? false);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exit(1);
      }
    });

  ibkr
    .command("positions")
    .description(
      "Export open positions as CSV with symbol, company name, and market value",
    )
    .option("--account-id <id>", "IBKR account id (for example U1234567)")
    .option("--base-url <url>", "Client Portal Gateway base URL")
    .option(
      "--verify-tls",
      "Verify TLS certificates when talking to gateway",
      false,
    )
    .option("--output <path>", "Write CSV to file instead of stdout")
    .action(async (options: IbkrPositionsOptions) => {
      try {
        const service = createIbkrPortfolioService({
          baseUrl: options.baseUrl,
          verifyTls: options.verifyTls,
        });
        const result = await service.stockPositions({
          accountId: options.accountId,
        });
        if (!result.ok) {
          throw new Error(result.message);
        }

        const rows = result.data.positions.map((position) =>
          [
            position.symbol,
            position.companyName,
            String(position.marketValue ?? ""),
          ]
            .map(csvEscape)
            .join(","),
        );

        const csv = ["symbol,companyName,marketValue", ...rows].join("\n");

        if (options.output) {
          writeFileSync(options.output, `${csv}\n`, "utf8");
          console.error(
            `Wrote ${result.data.positions.length} position(s) to ${options.output}`,
          );
        } else {
          console.log(csv);
        }
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

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
