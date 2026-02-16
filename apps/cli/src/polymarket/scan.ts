import {
  getOrderbookSummary,
  listMarkets,
  rankMispricingSignals,
  toOrderbookSnapshot,
  type MispricingSignal,
  type MispricingTrace,
  type PolymarketMarket,
} from "@repo/polymarket";

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;
export const DEFAULT_FETCH_MULTIPLIER = 5;
export const MAX_FETCH_LIMIT = 500;
export const DEFAULT_MAX_SPREAD_BPS = 800;
export const DEFAULT_TIME_HORIZON_HOURS = 24;
export const MIN_TIME_HORIZON_HOURS = 1;
export const MAX_TIME_HORIZON_HOURS = 168;
export const DEFAULT_CONCURRENCY = 6;
export const MAX_CONCURRENCY = 12;

export type PolymarketScanInput = {
  query?: string;
  limit?: number;
  minVolume?: number;
  maxSpreadBps?: number;
  timeHorizonHours?: number;
  concurrency?: number;
  includeTrace?: boolean;
};

export type PolymarketScanSuccess = {
  ok: true;
  query: string | null;
  generatedAt: string;
  parameters: {
    limit: number;
    minVolume: number;
    maxSpreadBps: number;
    timeHorizonHours: number;
    concurrency: number;
  };
  scannedMarkets: number;
  returnedSignals: number;
  opportunities: MispricingSignal[];
  warnings: string[];
  trace?: MispricingTrace[];
  disclaimer: string;
};

export type PolymarketScanError = {
  ok: false;
  error: string;
};

export type PolymarketScanResult = PolymarketScanSuccess | PolymarketScanError;

type NormalizedScanInput = {
  query: string | undefined;
  limit: number;
  minVolume: number;
  maxSpreadBps: number;
  timeHorizonHours: number;
  concurrency: number;
  includeTrace: boolean;
};

export async function scanPolymarketMispricing(
  input: PolymarketScanInput,
): Promise<PolymarketScanResult> {
  try {
    const normalized = normalizeInput(input);
    const query = normalizeQuery(normalized.query);
    const nowIso = new Date().toISOString();
    const fetchLimit = Math.min(
      MAX_FETCH_LIMIT,
      Math.max(normalized.limit * DEFAULT_FETCH_MULTIPLIER, 25),
    );

    const markets = await listMarkets({
      params: {
        limit: fetchLimit,
        closed: false,
        minVolume: normalized.minVolume,
      },
    });

    const scanCandidates = markets
      .filter(
        (market) => market.active && !market.closed && market.acceptingOrders,
      )
      .filter((market) => market.clobTokenIds.length > 0)
      .filter((market) => matchesQuery(market, query));

    const relatedByEvent = groupByEventId(scanCandidates);
    const warnings: string[] = [];

    const snapshots = await mapWithConcurrency(
      scanCandidates,
      normalized.concurrency,
      async (market) => {
        const tokenId = resolveReferenceTokenId(market);
        if (!tokenId) {
          warnings.push(`Skipped ${market.id}: missing tokenId.`);
          return null;
        }

        try {
          const summary = await getOrderbookSummary({ tokenId });
          return toOrderbookSnapshot(summary);
        } catch (error) {
          warnings.push(
            `Failed orderbook for ${market.slug ?? market.id}: ${formatError(error)}`,
          );
          return null;
        }
      },
    );

    const scoredCandidates = scanCandidates.map((market, index) => ({
      market,
      orderbook: snapshots[index] ?? null,
      relatedMarkets: getRelatedMarkets(relatedByEvent, market),
    }));

    const ranking = rankMispricingSignals({
      candidates: scoredCandidates,
      nowIso,
      timeHorizonHours: normalized.timeHorizonHours,
      minVolume: normalized.minVolume,
      maxSpreadBps: normalized.maxSpreadBps,
      limit: normalized.limit,
      includeTrace: normalized.includeTrace,
    });

    return {
      ok: true,
      query,
      generatedAt: nowIso,
      parameters: {
        limit: normalized.limit,
        minVolume: normalized.minVolume,
        maxSpreadBps: normalized.maxSpreadBps,
        timeHorizonHours: normalized.timeHorizonHours,
        concurrency: normalized.concurrency,
      },
      scannedMarkets: scoredCandidates.length,
      returnedSignals: ranking.signals.length,
      opportunities: ranking.signals,
      warnings,
      trace: normalized.includeTrace ? ranking.traces : undefined,
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

function normalizeInput(input: PolymarketScanInput): NormalizedScanInput {
  const limit = normalizePositiveInteger(input.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const minVolume = normalizeNonNegativeNumber(input.minVolume, 0);
  const maxSpreadBps = normalizePositiveNumber(
    input.maxSpreadBps,
    DEFAULT_MAX_SPREAD_BPS,
  );
  const timeHorizonHours = normalizeBoundedNumber(
    input.timeHorizonHours,
    DEFAULT_TIME_HORIZON_HOURS,
    MIN_TIME_HORIZON_HOURS,
    MAX_TIME_HORIZON_HOURS,
  );
  const concurrency = normalizePositiveInteger(
    input.concurrency,
    DEFAULT_CONCURRENCY,
    MAX_CONCURRENCY,
  );

  return {
    query: input.query,
    limit,
    minVolume,
    maxSpreadBps,
    timeHorizonHours,
    concurrency,
    includeTrace: input.includeTrace === true,
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

function groupByEventId(
  markets: PolymarketMarket[],
): Map<string, PolymarketMarket[]> {
  const groups = new Map<string, PolymarketMarket[]>();

  for (const market of markets) {
    const key = market.eventId?.trim();
    if (!key) {
      continue;
    }

    const current = groups.get(key);
    if (current) {
      current.push(market);
    } else {
      groups.set(key, [market]);
    }
  }

  return groups;
}

function getRelatedMarkets(
  relatedByEvent: Map<string, PolymarketMarket[]>,
  market: PolymarketMarket,
): PolymarketMarket[] {
  const eventId = market.eventId?.trim();
  if (!eventId) {
    return [];
  }

  return (relatedByEvent.get(eventId) ?? []).filter(
    (peer) => peer.id !== market.id,
  );
}

function resolveReferenceTokenId(market: PolymarketMarket): string | null {
  if (market.clobTokenIds.length === 0) {
    return null;
  }

  const yesIndex = market.outcomes.findIndex(
    (outcome) => outcome.trim().toUpperCase() === "YES",
  );
  const probabilityIndex = yesIndex >= 0 ? yesIndex : 0;

  return (
    market.clobTokenIds[probabilityIndex] ?? market.clobTokenIds[0] ?? null
  );
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  if (items.length === 0) {
    return [];
  }

  const workers = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<U>(items.length);
  let index = 0;

  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (index < items.length) {
        const currentIndex = index;
        index += 1;

        const item = items[currentIndex];
        if (item === undefined) {
          break;
        }

        results[currentIndex] = await mapper(item, currentIndex);
      }
    }),
  );

  return results;
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
  max?: number,
): number {
  const normalized = value ?? fallback;
  if (
    !Number.isFinite(normalized) ||
    !Number.isInteger(normalized) ||
    normalized <= 0
  ) {
    throw new Error("limit and concurrency must be positive integers.");
  }

  return max === undefined ? normalized : Math.min(normalized, max);
}

function normalizePositiveNumber(
  value: number | undefined,
  fallback: number,
): number {
  const normalized = value ?? fallback;
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("maxSpreadBps must be a positive number.");
  }

  return normalized;
}

function normalizeNonNegativeNumber(
  value: number | undefined,
  fallback: number,
): number {
  const normalized = value ?? fallback;
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error("minVolume must be a non-negative number.");
  }

  return normalized;
}

function normalizeBoundedNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const normalized = value ?? fallback;
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("timeHorizonHours must be a positive number.");
  }

  return Math.min(max, Math.max(min, normalized));
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
