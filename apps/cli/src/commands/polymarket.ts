import {
  getOrderbookSummary,
  listMarkets,
  rankMispricingSignals,
  toOrderbookSnapshot,
  type MispricingSignal,
  type MispricingTrace,
  type PolymarketMarket,
} from "@repo/polymarket";
import type { Command } from "commander";

const DEFAULT_LIMIT = 20;
const DEFAULT_FETCH_MULTIPLIER = 5;
const DEFAULT_MAX_SPREAD_BPS = 800;
const DEFAULT_TIME_HORIZON_HOURS = 24;
const DEFAULT_CONCURRENCY = 6;

type PolymarketScanOptions = {
  query?: string;
  limit?: number;
  minVolume?: number;
  maxSpreadBps?: number;
  timeHorizonHours?: number;
  concurrency?: number;
  trace?: boolean;
  minimal?: boolean;
};

type PolymarketScanPayload = {
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

type PolymarketErrorPayload = {
  ok: false;
  error: string;
};

export function registerPolymarketCommand(program: Command): void {
  const polymarket = program
    .command("polymarket")
    .description("Polymarket market scanning and microstructure analysis");

  polymarket
    .command("scan")
    .description("Scan Polymarket for potentially mispriced opportunities")
    .option("--query <text>", "Filter markets by question or slug text")
    .option(
      "--limit <number>",
      "Max ranked signals to return",
      parsePositiveInt,
      DEFAULT_LIMIT,
    )
    .option(
      "--min-volume <number>",
      "Minimum 24h volume filter for scan candidates",
      parseNonNegativeNumber,
      0,
    )
    .option(
      "--max-spread-bps <number>",
      "Maximum spread (bps) allowed in final ranking",
      parsePositiveNumber,
      DEFAULT_MAX_SPREAD_BPS,
    )
    .option(
      "--time-horizon-hours <number>",
      "Horizon used for momentum dislocation weighting",
      parsePositiveNumber,
      DEFAULT_TIME_HORIZON_HOURS,
    )
    .option(
      "--concurrency <number>",
      "Parallel orderbook fetches",
      parsePositiveInt,
      DEFAULT_CONCURRENCY,
    )
    .option("--trace", "Include deterministic scoring trace in output", false)
    .option("--minimal", "Output minified JSON", false)
    .action(async (options: PolymarketScanOptions) => {
      const nowIso = new Date().toISOString();
      const limit = options.limit ?? DEFAULT_LIMIT;
      const minVolume = options.minVolume ?? 0;
      const maxSpreadBps = options.maxSpreadBps ?? DEFAULT_MAX_SPREAD_BPS;
      const timeHorizonHours =
        options.timeHorizonHours ?? DEFAULT_TIME_HORIZON_HOURS;
      const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
      const traceEnabled = options.trace === true;

      try {
        const query = normalizeQuery(options.query);
        const fetchLimit = Math.min(
          500,
          Math.max(limit * DEFAULT_FETCH_MULTIPLIER, 25),
        );

        logTrace(traceEnabled, `fetching up to ${fetchLimit} active markets`);
        const markets = await listMarkets({
          params: {
            limit: fetchLimit,
            closed: false,
            minVolume,
          },
        });

        const scanCandidates = markets
          .filter(
            (market) =>
              market.active && !market.closed && market.acceptingOrders,
          )
          .filter((market) => market.clobTokenIds.length > 0)
          .filter((market) => matchesQuery(market, query));

        logTrace(
          traceEnabled,
          `prepared ${scanCandidates.length} candidate markets after filters`,
        );

        const relatedByEvent = groupByEventId(scanCandidates);
        const warnings: string[] = [];

        const snapshots = await mapWithConcurrency(
          scanCandidates,
          concurrency,
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
          timeHorizonHours,
          minVolume,
          maxSpreadBps,
          limit,
          includeTrace: traceEnabled,
        });

        const payload: PolymarketScanPayload = {
          ok: true,
          query,
          generatedAt: nowIso,
          parameters: {
            limit,
            minVolume,
            maxSpreadBps,
            timeHorizonHours,
            concurrency,
          },
          scannedMarkets: scoredCandidates.length,
          returnedSignals: ranking.signals.length,
          opportunities: ranking.signals,
          warnings,
          trace: traceEnabled ? ranking.traces : undefined,
          disclaimer:
            "Educational analysis only. This output is informational and not investment advice.",
        };

        outputJson(payload, options.minimal ?? false);
      } catch (error) {
        const payload: PolymarketErrorPayload = {
          ok: false,
          error: formatError(error),
        };

        outputJson(payload, options.minimal ?? false);
        process.exit(1);
      }
    });
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

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error("Value must be a positive integer.");
  }

  return parsed;
}

function parsePositiveNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Value must be a positive number.");
  }

  return parsed;
}

function parseNonNegativeNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Value must be a non-negative number.");
  }

  return parsed;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function outputJson(payload: unknown, minimal = false): void {
  const json = minimal
    ? JSON.stringify(payload)
    : JSON.stringify(payload, null, 2);
  console.log(json);
}

function logTrace(enabled: boolean, message: string): void {
  if (!enabled) {
    return;
  }

  console.error(`[trace] ${message}`);
}
