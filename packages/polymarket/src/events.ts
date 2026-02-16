import { listEvents } from "./gamma";
import type { PolymarketEvent } from "./types";

export const DEFAULT_EVENTS_LIMIT = 20;
export const MAX_EVENTS_LIMIT = 100;

export type PolymarketActiveEventsInput = {
  query?: string;
  limit?: number;
  minVolume?: number;
  minLiquidity?: number;
};

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
};

export type PolymarketActiveEventsResult =
  | PolymarketActiveEventsSuccess
  | PolymarketActiveEventsError;

export async function listPolymarketActiveEvents(
  input: PolymarketActiveEventsInput,
): Promise<PolymarketActiveEventsResult> {
  try {
    const normalized = normalizeInput(input);
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

function normalizeInput(input: PolymarketActiveEventsInput): {
  query: string | null;
  limit: number;
  minVolume: number;
  minLiquidity: number;
} {
  const limit = normalizePositiveInteger(input.limit, DEFAULT_EVENTS_LIMIT);
  if (limit > MAX_EVENTS_LIMIT) {
    throw new Error(`limit must be <= ${MAX_EVENTS_LIMIT}.`);
  }

  return {
    query: normalizeQuery(input.query),
    limit,
    minVolume: normalizeNonNegativeNumber(input.minVolume, 0),
    minLiquidity: normalizeNonNegativeNumber(input.minLiquidity, 0),
  };
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

function normalizeQuery(input?: string): string | null {
  if (!input) {
    return null;
  }

  const normalized = input.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function matchesQuery(event: PolymarketEvent, query: string | null): boolean {
  if (!query) {
    return true;
  }

  const haystack = `${event.title ?? ""} ${event.slug ?? ""}`.toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);

  return terms.every((term) => haystack.includes(term));
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  const normalized = value ?? fallback;
  if (
    !Number.isFinite(normalized) ||
    !Number.isInteger(normalized) ||
    normalized <= 0
  ) {
    throw new Error("limit must be a positive integer.");
  }

  return normalized;
}

function normalizeNonNegativeNumber(
  value: number | undefined,
  fallback: number,
): number {
  const normalized = value ?? fallback;
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error("minVolume and minLiquidity must be non-negative numbers.");
  }

  return normalized;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
