import {
  DEFAULT_CONCURRENCY,
  DEFAULT_LIMIT,
  DEFAULT_MAX_SPREAD_BPS,
  DEFAULT_TIME_HORIZON_HOURS,
  scanPolymarketMispricing,
} from "../polymarket/scan";
import type { Command } from "commander";

type PolymarketScanOptions = {
  query?: string;
  limit?: number;
  minVolume?: number;
  maxSpreadBps?: number;
  timeHorizonHours?: number;
  concurrency?: number;
  trace?: boolean;
  minimal?: boolean;
};

export function registerPolymarketCommand(program: Command): void {
  const polymarket = program
    .command("polymarket")
    .description("Polymarket market scanning and microstructure analysis");

  polymarket
    .command("scan")
    .description("Scan Polymarket for potentially mispriced opportunities")
    .option("--query <text>", "Filter markets by question or slug text")
    .option(
      "--limit <number>",
      "Max ranked signals to return",
      parsePositiveInt,
      DEFAULT_LIMIT,
    )
    .option(
      "--min-volume <number>",
      "Minimum 24h volume filter for scan candidates",
      parseNonNegativeNumber,
      0,
    )
    .option(
      "--max-spread-bps <number>",
      "Maximum spread (bps) allowed in final ranking",
      parsePositiveNumber,
      DEFAULT_MAX_SPREAD_BPS,
    )
    .option(
      "--time-horizon-hours <number>",
      "Horizon used for momentum dislocation weighting",
      parsePositiveNumber,
      DEFAULT_TIME_HORIZON_HOURS,
    )
    .option(
      "--concurrency <number>",
      "Parallel orderbook fetches",
      parsePositiveInt,
      DEFAULT_CONCURRENCY,
    )
    .option("--trace", "Include deterministic scoring trace in output", false)
    .option("--minimal", "Output minified JSON", false)
    .action(async (options: PolymarketScanOptions) => {
      const result = await scanPolymarketMispricing({
        query: options.query,
        limit: options.limit,
        minVolume: options.minVolume,
        maxSpreadBps: options.maxSpreadBps,
        timeHorizonHours: options.timeHorizonHours,
        concurrency: options.concurrency,
        includeTrace: options.trace === true,
      });

      outputJson(result, options.minimal ?? false);

      if (!result.ok) {
        process.exit(1);
      }
    });
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error("Value must be a positive integer.");
  }

  return parsed;
}

function parsePositiveNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Value must be a positive number.");
  }

  return parsed;
}

function parseNonNegativeNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Value must be a non-negative number.");
  }

  return parsed;
}

function outputJson(payload: unknown, minimal = false): void {
  const json = minimal
    ? JSON.stringify(payload)
    : JSON.stringify(payload, null, 2);
  console.log(json);
}
