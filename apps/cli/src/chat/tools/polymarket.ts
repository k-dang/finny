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
import { jsonSchema, tool } from "ai";
import { z } from "zod";

const TOOL_MAX_LIMIT = 30;

type PolymarketMispricingScanInput = {
  query?: string;
  limit?: number;
  minVolume?: number;
  maxSpreadBps?: number;
  timeHorizonHours?: number;
};

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
    inputSchema: jsonSchema<PolymarketMispricingScanInput>({
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Optional search text matched against market question and slug.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: TOOL_MAX_LIMIT,
          description:
            "Maximum ranked opportunities to return (default 20, max 30).",
        },
        minVolume: {
          type: "number",
          minimum: 0,
          description: "Minimum 24h market volume used to filter candidates.",
        },
        maxSpreadBps: {
          type: "number",
          minimum: 1,
          description: "Maximum allowed spread in bps for ranked signals.",
        },
        timeHorizonHours: {
          type: "number",
          minimum: 1,
          maximum: 168,
          description:
            "Horizon used by momentum dislocation scoring (1-168 hours).",
        },
      },
      additionalProperties: false,
    }),
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
