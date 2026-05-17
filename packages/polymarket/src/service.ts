import {
  listEvents as listGammaEvents,
  listMarkets as listGammaMarkets,
} from "./gamma";
import type {
  ListEventsParams,
  ListMarketsParams,
  PolymarketEvent,
  PolymarketMarket,
} from "./types";

export const DEFAULT_EVENTS_LIMIT = 20;
export const MAX_EVENTS_LIMIT = 100;
export const DEFAULT_MARKETS_LIMIT = 20;
export const MAX_MARKETS_LIMIT = 100;

export type GammaPolymarketClient = {
  listEvents(params: ListEventsParams): Promise<PolymarketEvent[]>;
  listMarkets(params: ListMarketsParams): Promise<PolymarketMarket[]>;
};

export type PolymarketServiceLimits = {
  events?: {
    default?: number;
    max?: number;
  };
  markets?: {
    default?: number;
    max?: number;
  };
};

export type CreatePolymarketServiceOptions = {
  gammaClient?: GammaPolymarketClient;
  limits?: PolymarketServiceLimits;
};

type PolymarketQueryInput = {
  query?: string;
  limit?: number;
  minVolume?: number;
  minLiquidity?: number;
};

type PolymarketError = {
  ok: false;
  error: string;
};

type PolymarketResult<TSuccess> = TSuccess | PolymarketError;

export type PolymarketActiveEventsInput = PolymarketQueryInput;

type PolymarketActiveEvent = Pick<
  PolymarketEvent,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "active"
  | "closed"
  | "endDate"
  | "volume"
  | "volume24hr"
  | "liquidity"
> & {
  marketCount: number;
  openMarkets: number;
  acceptingOrderMarkets: number;
};

export type PolymarketMarketsInput = PolymarketQueryInput & {
  activeOnly?: boolean;
  acceptingOrdersOnly?: boolean;
  requireTokenIds?: boolean;
};

type PolymarketMarketSnapshot = PolymarketMarket & {
  midpoint: number | null;
  spreadBps: number | null;
};

export type PolymarketActiveEventsResult = PolymarketResult<{
  ok: true;
  query: string | null;
  generatedAt: string;
  parameters: PolymarketQueryParams & { active: true; closed: false };
  returnedEvents: number;
  events: PolymarketActiveEvent[];
}>;

export type PolymarketMarketsResult = PolymarketResult<{
  ok: true;
  query: string | null;
  generatedAt: string;
  parameters: PolymarketQueryParams & {
    activeOnly: boolean;
    acceptingOrdersOnly: boolean;
    requireTokenIds: boolean;
  };
  returnedMarkets: number;
  markets: PolymarketMarketSnapshot[];
}>;

export type PolymarketService = {
  activeEvents(
    input?: PolymarketActiveEventsInput,
  ): Promise<PolymarketActiveEventsResult>;
  markets(input?: PolymarketMarketsInput): Promise<PolymarketMarketsResult>;
};

type PolymarketQueryParams = {
  limit: number;
  minVolume: number;
  minLiquidity: number;
};

const defaultGammaClient: GammaPolymarketClient = {
  listEvents: (params) => listGammaEvents({ params }),
  listMarkets: (params) => listGammaMarkets({ params }),
};

export function createPolymarketService(
  options: CreatePolymarketServiceOptions = {},
): PolymarketService {
  const gammaClient = options.gammaClient ?? defaultGammaClient;
  const eventDefaults = {
    default: options.limits?.events?.default ?? DEFAULT_EVENTS_LIMIT,
    max: options.limits?.events?.max ?? MAX_EVENTS_LIMIT,
  };
  const marketDefaults = {
    default: options.limits?.markets?.default ?? DEFAULT_MARKETS_LIMIT,
    max: options.limits?.markets?.max ?? MAX_MARKETS_LIMIT,
  };

  return {
    activeEvents: async (input = {}) => {
      try {
        const params = readQueryParams(input, eventDefaults);
        const query = readQuery(input.query);
        const events = await gammaClient.listEvents({
          active: true,
          closed: false,
          ...params,
        });
        const filtered = events
          .filter((event) => event.active && !event.closed)
          .filter((event) => matchesEventQuery(event, query));

        return {
          ok: true,
          query,
          generatedAt: new Date().toISOString(),
          parameters: {
            ...params,
            active: true,
            closed: false,
          },
          returnedEvents: filtered.length,
          events: filtered.map(toActiveEvent),
        };
      } catch (error) {
        return { ok: false, error: formatError(error) };
      }
    },

    markets: async (input = {}) => {
      try {
        const params = readQueryParams(input, marketDefaults);
        const query = readQuery(input.query);
        const activeOnly = input.activeOnly ?? true;
        const acceptingOrdersOnly = input.acceptingOrdersOnly ?? true;
        const requireTokenIds = input.requireTokenIds ?? true;
        const markets = await gammaClient.listMarkets({
          ...params,
          closed: activeOnly ? false : undefined,
        });
        const filtered = markets
          .filter((market) => matchesMarketQuery(market, query))
          .filter((market) =>
            activeOnly ? market.active && !market.closed : true,
          )
          .filter((market) =>
            acceptingOrdersOnly ? market.acceptingOrders : true,
          )
          .filter((market) =>
            requireTokenIds ? market.clobTokenIds.length > 0 : true,
          );

        return {
          ok: true,
          query,
          generatedAt: new Date().toISOString(),
          parameters: {
            ...params,
            activeOnly,
            acceptingOrdersOnly,
            requireTokenIds,
          },
          returnedMarkets: filtered.length,
          markets: filtered.map(toMarketSnapshot),
        };
      } catch (error) {
        return { ok: false, error: formatError(error) };
      }
    },
  };
}

function readQueryParams(
  input: PolymarketQueryInput,
  limits: { default: number; max: number },
): PolymarketQueryParams {
  const limit = readPositiveInteger(input.limit, limits.default);
  if (limit > limits.max) {
    throw new Error(`limit must be <= ${limits.max}.`);
  }

  return {
    limit,
    minVolume: readNonNegativeNumber(input.minVolume, 0),
    minLiquidity: readNonNegativeNumber(input.minLiquidity, 0),
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

function toMarketSnapshot(market: PolymarketMarket): PolymarketMarketSnapshot {
  const midpoint =
    market.bestBid !== null && market.bestAsk !== null
      ? (market.bestBid + market.bestAsk) / 2
      : null;

  return {
    ...market,
    midpoint,
    spreadBps: resolveSpreadBps(market, midpoint),
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

function readQuery(input?: string): string | null {
  if (!input) {
    return null;
  }

  const normalized = input.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function matchesEventQuery(
  event: PolymarketEvent,
  query: string | null,
): boolean {
  if (!query) {
    return true;
  }

  const haystack = `${event.title ?? ""} ${event.slug ?? ""}`.toLowerCase();
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function matchesMarketQuery(
  market: PolymarketMarket,
  query: string | null,
): boolean {
  if (!query) {
    return true;
  }

  const haystack =
    `${market.question ?? ""} ${market.slug ?? ""}`.toLowerCase();
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function readPositiveInteger(
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

function readNonNegativeNumber(
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
