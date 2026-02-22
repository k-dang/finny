import {
  DEFAULT_EVENTS_LIMIT,
  DEFAULT_MARKETS_LIMIT,
  listPolymarketActiveEvents,
  listPolymarketMarkets,
  MAX_EVENTS_LIMIT,
  MAX_MARKETS_LIMIT,
} from "@repo/polymarket";
import { tool } from "@opencode-ai/plugin";

const TOOL_MAX_EVENTS_LIMIT = Math.min(30, MAX_EVENTS_LIMIT);
const TOOL_MAX_MARKETS_LIMIT = Math.min(50, MAX_MARKETS_LIMIT);

type PolymarketToolError = {
  ok: false;
  error: string;
};

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const active_events = tool({
  description:
    "List current active Polymarket events (active=true and closed=false), with optional text and liquidity filters.",
  args: {
    query: tool.schema
      .string()
      .optional()
      .describe("Optional text matched against event title and slug."),
    limit: tool.schema.coerce
      .number()
      .int()
      .positive()
      .max(TOOL_MAX_EVENTS_LIMIT)
      .default(DEFAULT_EVENTS_LIMIT)
      .describe("Maximum active events to return (tool max 30)."),
    minVolume: tool.schema.coerce
      .number()
      .nonnegative()
      .default(0)
      .describe("Minimum event volume filter."),
    minLiquidity: tool.schema.coerce
      .number()
      .nonnegative()
      .default(0)
      .describe("Minimum event liquidity filter."),
  },
  execute: async ({
    query,
    limit,
    minVolume,
    minLiquidity,
  }): Promise<string> => {
    try {
      const result = await listPolymarketActiveEvents({
        query,
        limit,
        minVolume,
        minLiquidity,
      });

      return JSON.stringify(result);
    } catch (error) {
      const result: PolymarketToolError = {
        ok: false,
        error: formatError(error),
      };

      return JSON.stringify(result);
    }
  },
});

export const markets = tool({
  description:
    "List Polymarket markets with raw pricing and momentum fields used for microstructure analysis.",
  args: {
    query: tool.schema
      .string()
      .optional()
      .describe(
        "Optional search text matched against market question and slug.",
      ),
    limit: tool.schema.coerce
      .number()
      .int()
      .positive()
      .max(TOOL_MAX_MARKETS_LIMIT)
      .default(DEFAULT_MARKETS_LIMIT)
      .describe("Maximum markets to return (tool max 50)."),
    minVolume: tool.schema.coerce
      .number()
      .nonnegative()
      .default(0)
      .describe("Minimum 24h market volume filter."),
    minLiquidity: tool.schema.coerce
      .number()
      .nonnegative()
      .default(0)
      .describe("Minimum market liquidity filter."),
    activeOnly: tool.schema
      .boolean()
      .default(true)
      .describe("If true, include only active and open markets."),
    acceptingOrdersOnly: tool.schema
      .boolean()
      .default(true)
      .describe("If true, include only markets currently accepting orders."),
    requireTokenIds: tool.schema
      .boolean()
      .default(true)
      .describe(
        "If true, include only markets with at least one CLOB token id.",
      ),
  },
  execute: async ({
    query,
    limit,
    minVolume,
    minLiquidity,
    activeOnly,
    acceptingOrdersOnly,
    requireTokenIds,
  }): Promise<string> => {
    try {
      const result = await listPolymarketMarkets({
        query,
        limit,
        minVolume,
        minLiquidity,
        activeOnly,
        acceptingOrdersOnly,
        requireTokenIds,
      });

      return JSON.stringify(result);
    } catch (error) {
      const result: PolymarketToolError = {
        ok: false,
        error: formatError(error),
      };

      return JSON.stringify(result);
    }
  },
});
