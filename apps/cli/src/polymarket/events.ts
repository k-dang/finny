import { listEvents, type PolymarketEvent } from "@repo/polymarket";
import { z } from "zod";

export const DEFAULT_EVENTS_LIMIT = 20;
export const MAX_EVENTS_LIMIT = 100;

export const polymarketActiveEventsInputSchema = z
  .object({
    query: z
      .string()
      .optional()
      .transform((value) => {
        if (!value) {
          return null;
        }

        const normalized = value.trim().toLowerCase();
        return normalized.length > 0 ? normalized : null;
      }),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_EVENTS_LIMIT)
      .default(DEFAULT_EVENTS_LIMIT),
    minVolume: z.coerce.number().nonnegative().default(0),
    minLiquidity: z.coerce.number().nonnegative().default(0),
  })
  .strict();

export type PolymarketActiveEventsInput = z.input<
  typeof polymarketActiveEventsInputSchema
>;

export type PolymarketActiveEvent = {
  id: string;
  slug: string | null;
  title: string | null;
  description: string | null;
  active: boolean;
  closed: boolean;
  endDate: string | null;
  volume: number | null;
  volume24hr: number | null;
  liquidity: number | null;
  marketCount: number;
  openMarkets: number;
  acceptingOrderMarkets: number;
};

export type PolymarketActiveEventsSuccess = {
  ok: true;
  query: string | null;
  generatedAt: string;
  parameters: {
    limit: number;
    minVolume: number;
    minLiquidity: number;
    active: true;
    closed: false;
  };
  returnedEvents: number;
  events: PolymarketActiveEvent[];
  disclaimer: string;
};

export type PolymarketActiveEventsError = {
  ok: false;
  error: string;
  issues?: Array<{
    path: string;
    message: string;
  }>;
};

export type PolymarketActiveEventsResult =
  | PolymarketActiveEventsSuccess
  | PolymarketActiveEventsError;

type NormalizedInput = z.output<typeof polymarketActiveEventsInputSchema>;

export async function listPolymarketActiveEvents(
  input: PolymarketActiveEventsInput,
): Promise<PolymarketActiveEventsResult> {
  try {
    const parsed = polymarketActiveEventsInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Invalid input.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      };
    }

    const normalized: NormalizedInput = parsed.data;
    const generatedAt = new Date().toISOString();

    const events = await listEvents({
      params: {
        active: true,
        closed: false,
        limit: normalized.limit,
        minVolume: normalized.minVolume,
        minLiquidity: normalized.minLiquidity,
      },
    });

    const filtered = events
      .filter((event) => event.active && !event.closed)
      .filter((event) => matchesQuery(event, normalized.query));

    return {
      ok: true,
      query: normalized.query,
      generatedAt,
      parameters: {
        limit: normalized.limit,
        minVolume: normalized.minVolume,
        minLiquidity: normalized.minLiquidity,
        active: true,
        closed: false,
      },
      returnedEvents: filtered.length,
      events: filtered.map(toActiveEvent),
      disclaimer:
        "Educational analysis only. This output is informational and not investment advice.",
    };
  } catch (error) {
    return {
      ok: false,
      error: formatError(error),
    };
  }
}

function toActiveEvent(event: PolymarketEvent): PolymarketActiveEvent {
  const marketCount = event.markets.length;
  const openMarkets = event.markets.filter((market) => !market.closed).length;
  const acceptingOrderMarkets = event.markets.filter(
    (market) => market.acceptingOrders,
  ).length;

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    active: event.active,
    closed: event.closed,
    endDate: event.endDate,
    volume: event.volume,
    volume24hr: event.volume24hr,
    liquidity: event.liquidity,
    marketCount,
    openMarkets,
    acceptingOrderMarkets,
  };
}

function matchesQuery(event: PolymarketEvent, query: string | null): boolean {
  if (!query) {
    return true;
  }

  const haystack = `${event.title ?? ""} ${event.slug ?? ""}`.toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);

  return terms.every((term) => haystack.includes(term));
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
