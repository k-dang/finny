import { listMarkets } from "./gamma";
import type { PolymarketMarket } from "./types";

export const DEFAULT_MARKETS_LIMIT = 20;
export const MAX_MARKETS_LIMIT = 100;

export type PolymarketMarketsInput = {
  query?: string;
  limit?: number;
  minVolume?: number;
  minLiquidity?: number;
  activeOnly?: boolean;
  acceptingOrdersOnly?: boolean;
  requireTokenIds?: boolean;
};

export type PolymarketMarketSnapshot = PolymarketMarket & {
  midpoint: number | null;
  spreadBps: number | null;
};

export type PolymarketMarketsSuccess = {
  ok: true;
  query: string | null;
  generatedAt: string;
  parameters: {
    limit: number;
    minVolume: number;
    minLiquidity: number;
    activeOnly: boolean;
    acceptingOrdersOnly: boolean;
    requireTokenIds: boolean;
  };
  returnedMarkets: number;
  markets: PolymarketMarketSnapshot[];
  disclaimer: string;
};

export type PolymarketMarketsError = {
  ok: false;
  error: string;
};

export type PolymarketMarketsResult =
  | PolymarketMarketsSuccess
  | PolymarketMarketsError;

type NormalizedMarketsInput = {
  query: string | null;
  limit: number;
  minVolume: number;
  minLiquidity: number;
  activeOnly: boolean;
  acceptingOrdersOnly: boolean;
  requireTokenIds: boolean;
};

export async function listPolymarketMarkets(
  input: PolymarketMarketsInput,
): Promise<PolymarketMarketsResult> {
  try {
    const normalized = normalizeInput(input);
    const generatedAt = new Date().toISOString();

    const markets = await listMarkets({
      params: {
        limit: normalized.limit,
        closed: normalized.activeOnly ? false : undefined,
        minVolume: normalized.minVolume,
        minLiquidity: normalized.minLiquidity,
      },
    });

    const filtered = markets
      .filter((market) => matchesQuery(market, normalized.query))
      .filter((market) =>
        normalized.activeOnly ? market.active && !market.closed : true,
      )
      .filter((market) =>
        normalized.acceptingOrdersOnly ? market.acceptingOrders : true,
      )
      .filter((market) =>
        normalized.requireTokenIds ? market.clobTokenIds.length > 0 : true,
      );

    return {
      ok: true,
      query: normalized.query,
      generatedAt,
      parameters: {
        limit: normalized.limit,
        minVolume: normalized.minVolume,
        minLiquidity: normalized.minLiquidity,
        activeOnly: normalized.activeOnly,
        acceptingOrdersOnly: normalized.acceptingOrdersOnly,
        requireTokenIds: normalized.requireTokenIds,
      },
      returnedMarkets: filtered.length,
      markets: filtered.map(toMarketSnapshot),
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

function normalizeInput(input: PolymarketMarketsInput): NormalizedMarketsInput {
  const limit = normalizePositiveInteger(input.limit, DEFAULT_MARKETS_LIMIT);
  if (limit > MAX_MARKETS_LIMIT) {
    throw new Error(`limit must be <= ${MAX_MARKETS_LIMIT}.`);
  }

  return {
    query: normalizeQuery(input.query),
    limit,
    minVolume: normalizeNonNegativeNumber(input.minVolume, 0),
    minLiquidity: normalizeNonNegativeNumber(input.minLiquidity, 0),
    activeOnly: input.activeOnly ?? true,
    acceptingOrdersOnly: input.acceptingOrdersOnly ?? true,
    requireTokenIds: input.requireTokenIds ?? true,
  };
}

function normalizeQuery(input?: string): string | null {
  if (!input) {
    return null;
  }

  const normalized = input.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function matchesQuery(market: PolymarketMarket, query: string | null): boolean {
  if (!query) {
    return true;
  }

  const haystack =
    `${market.question ?? ""} ${market.slug ?? ""}`.toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);

  return terms.every((term) => haystack.includes(term));
}

function toMarketSnapshot(market: PolymarketMarket): PolymarketMarketSnapshot {
  const midpoint =
    market.bestBid !== null && market.bestAsk !== null
      ? (market.bestBid + market.bestAsk) / 2
      : null;

  const spreadBps = resolveSpreadBps(market, midpoint);

  return {
    ...market,
    midpoint,
    spreadBps,
  };
}

function resolveSpreadBps(
  market: PolymarketMarket,
  midpoint: number | null,
): number | null {
  if (market.spread !== null) {
    return Math.max(0, market.spread * 10_000);
  }

  if (
    midpoint !== null &&
    midpoint > 0 &&
    market.bestBid !== null &&
    market.bestAsk !== null
  ) {
    return Math.max(0, ((market.bestAsk - market.bestBid) / midpoint) * 10_000);
  }

  return null;
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
