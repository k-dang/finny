import {
  DEFAULT_EVENTS_LIMIT,
  DEFAULT_MARKETS_LIMIT,
  listPolymarketActiveEvents,
  listPolymarketMarkets,
  MAX_EVENTS_LIMIT,
  MAX_MARKETS_LIMIT,
} from "@repo/polymarket";
import { tool } from "ai";
import { z } from "zod";

const TOOL_MAX_EVENTS_LIMIT = Math.min(30, MAX_EVENTS_LIMIT);
const TOOL_MAX_MARKETS_LIMIT = Math.min(50, MAX_MARKETS_LIMIT);

function createActiveEventsInputSchema(maxLimit: number) {
  return z
    .object({
      query: z
        .string()
        .optional()
        .describe("Optional text matched against event title and slug."),
      limit: z.coerce
        .number()
        .int()
        .positive()
        .max(maxLimit)
        .default(DEFAULT_EVENTS_LIMIT),
      minVolume: z.coerce.number().nonnegative().default(0),
      minLiquidity: z.coerce.number().nonnegative().default(0),
    })
    .strict();
}

function createMarketsInputSchema(maxLimit: number) {
  return z
    .object({
      query: z
        .string()
        .optional()
        .describe(
          "Optional search text matched against market question and slug.",
        ),
      limit: z.coerce
        .number()
        .int()
        .positive()
        .max(maxLimit)
        .default(DEFAULT_MARKETS_LIMIT)
        .describe("Maximum markets to return (tool max 50)."),
      minVolume: z.coerce
        .number()
        .nonnegative()
        .default(0)
        .describe("Minimum 24h market volume filter."),
      minLiquidity: z.coerce
        .number()
        .nonnegative()
        .default(0)
        .describe("Minimum market liquidity filter."),
      activeOnly: z.coerce
        .boolean()
        .default(true)
        .describe("If true, include only active and open markets."),
      acceptingOrdersOnly: z.coerce
        .boolean()
        .default(true)
        .describe("If true, include only markets currently accepting orders."),
      requireTokenIds: z.coerce
        .boolean()
        .default(true)
        .describe(
          "If true, include only markets with at least one CLOB token id.",
        ),
    })
    .strict();
}

const polymarketActiveEventsToolInputSchema = createActiveEventsInputSchema(
  TOOL_MAX_EVENTS_LIMIT,
);

const polymarketMarketsToolInputSchema = createMarketsInputSchema(
  TOOL_MAX_MARKETS_LIMIT,
);

export const polymarketTools = {
  polymarket_active_events: tool({
    description:
      "List current active Polymarket events (active=true and closed=false), with optional text and liquidity filters.",
    inputSchema: polymarketActiveEventsToolInputSchema,
    execute: async (input) => {
      return listPolymarketActiveEvents(input);
    },
  }),

  polymarket_markets: tool({
    description:
      "List Polymarket markets with raw pricing and momentum fields used for microstructure analysis.",
    inputSchema: polymarketMarketsToolInputSchema,
    execute: async (input) => {
      return listPolymarketMarkets(input);
    },
  }),
};
