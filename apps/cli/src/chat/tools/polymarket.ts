import {
  DEFAULT_EVENTS_LIMIT,
  listPolymarketActiveEvents,
  polymarketActiveEventsInputSchema,
} from "../../polymarket/events";
import {
  DEFAULT_LIMIT,
  DEFAULT_MAX_SPREAD_BPS,
  DEFAULT_TIME_HORIZON_HOURS,
  scanPolymarketMispricing,
} from "../../polymarket/scan";
import { tool } from "ai";
import { z } from "zod";

const TOOL_MAX_LIMIT = 30;

const polymarketMispricingScanInputSchema = z
  .object({
    query: z
      .string()
      .optional()
      .describe(
        "Optional search text matched against market question and slug.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(TOOL_MAX_LIMIT)
      .optional()
      .describe("Maximum ranked opportunities to return (default 20, max 30)."),
    minVolume: z
      .number()
      .min(0)
      .optional()
      .describe("Minimum 24h market volume used to filter candidates."),
    maxSpreadBps: z
      .number()
      .min(1)
      .optional()
      .describe("Maximum allowed spread in bps for ranked signals."),
    timeHorizonHours: z
      .number()
      .min(1)
      .max(168)
      .optional()
      .describe("Horizon used by momentum dislocation scoring (1-168 hours)."),
  })
  .strict();

const polymarketActiveEventsToolInputSchema =
  polymarketActiveEventsInputSchema.extend({
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(TOOL_MAX_LIMIT)
      .default(DEFAULT_EVENTS_LIMIT),
  });

export const polymarketTools = {
  polymarket_active_events: tool({
    description:
      "List current active Polymarket events (active=true and closed=false), with optional text and liquidity filters.",
    inputSchema: polymarketActiveEventsToolInputSchema,
    execute: async ({ query, limit, minVolume, minLiquidity }) => {
      return listPolymarketActiveEvents({
        query: query ?? undefined,
        limit: limit ?? DEFAULT_EVENTS_LIMIT,
        minVolume,
        minLiquidity,
      });
    },
  }),

  polymarket_mispricing_scan: tool({
    description:
      "Scan Polymarket markets for potentially mispriced YES/NO opportunities using read-only microstructure signals.",
    inputSchema: polymarketMispricingScanInputSchema,
    execute: async ({
      query,
      limit,
      minVolume,
      maxSpreadBps,
      timeHorizonHours,
    }) => {
      return scanPolymarketMispricing({
        query,
        limit: limit ?? DEFAULT_LIMIT,
        minVolume,
        maxSpreadBps: maxSpreadBps ?? DEFAULT_MAX_SPREAD_BPS,
        timeHorizonHours: timeHorizonHours ?? DEFAULT_TIME_HORIZON_HOURS,
        includeTrace: false,
      });
    },
  }),
};
