import {
  DEFAULT_EVENTS_LIMIT,
  DEFAULT_MARKETS_LIMIT,
  listPolymarketActiveEvents,
  listPolymarketMarkets,
  type PolymarketActiveEventsResult,
  type PolymarketMarketsResult,
} from "@repo/polymarket";
import type { Command } from "commander";

type PolymarketMarketsOptions = {
  query?: string;
  limit?: number;
  minVolume?: number;
  minLiquidity?: number;
  activeOnly?: boolean;
  acceptingOrdersOnly?: boolean;
  requireTokenIds?: boolean;
  minimal?: boolean;
};

type PolymarketEventsOptions = {
  query?: string;
  limit?: number;
  minVolume?: number;
  minLiquidity?: number;
  minimal?: boolean;
};

export function registerPolymarketCommand(program: Command): void {
  const polymarket = program
    .command("polymarket")
    .description("Polymarket market data snapshots");

  polymarket
    .command("events")
    .description("List current active Polymarket events")
    .option("--query <text>", "Filter events by title or slug text")
    .option(
      "--limit <number>",
      "Max active events to return",
      Number,
      DEFAULT_EVENTS_LIMIT,
    )
    .option("--min-volume <number>", "Minimum event volume filter", Number, 0)
    .option(
      "--min-liquidity <number>",
      "Minimum event liquidity filter",
      Number,
      0,
    )
    .option("--minimal", "Output minified JSON", false)
    .action(async (options: PolymarketEventsOptions) => {
      await runAndOutput(
        listPolymarketActiveEvents({
          query: options.query,
          limit: options.limit,
          minVolume: options.minVolume,
          minLiquidity: options.minLiquidity,
        }),
        options.minimal ?? false,
      );
    });

  polymarket
    .command("markets")
    .description("List Polymarket markets with raw pricing fields")
    .option("--query <text>", "Filter markets by question or slug text")
    .option(
      "--limit <number>",
      "Max markets to return",
      Number,
      DEFAULT_MARKETS_LIMIT,
    )
    .option(
      "--min-volume <number>",
      "Minimum 24h market volume filter",
      Number,
      0,
    )
    .option(
      "--min-liquidity <number>",
      "Minimum market liquidity filter",
      Number,
      0,
    )
    .option("--no-active-only", "Include inactive or closed markets")
    .option(
      "--no-accepting-orders-only",
      "Include markets not currently accepting orders",
    )
    .option(
      "--no-require-token-ids",
      "Include markets with missing CLOB token ids",
    )
    .option("--minimal", "Output minified JSON", false)
    .action(async (options: PolymarketMarketsOptions) => {
      await runAndOutput(
        listPolymarketMarkets({
          query: options.query,
          limit: options.limit,
          minVolume: options.minVolume,
          minLiquidity: options.minLiquidity,
          activeOnly: options.activeOnly,
          acceptingOrdersOnly: options.acceptingOrdersOnly,
          requireTokenIds: options.requireTokenIds,
        }),
        options.minimal ?? false,
      );
    });
}

async function runAndOutput(
  operation: Promise<PolymarketActiveEventsResult | PolymarketMarketsResult>,
  minimal: boolean,
): Promise<void> {
  const result = await operation;
  outputJson(result, minimal);

  if (!result.ok) {
    process.exit(1);
  }
}

function outputJson(payload: unknown, minimal = false): void {
  const json = minimal
    ? JSON.stringify(payload)
    : JSON.stringify(payload, null, 2);
  console.log(json);
}
