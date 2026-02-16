import {
  asBoolean,
  asNumber,
  asString,
  buildUrl,
  isRecord,
  PolymarketApiError,
  requestPolymarketJson,
} from "./http";
import { DEFAULT_GAMMA_BASE_URL } from "./constants";
import type {
  FetchLike,
  ListMarketsParams,
  PolymarketEvent,
  PolymarketMarket,
} from "./types";

type GammaMarketWire = Record<string, unknown>;
type GammaEventWire = Record<string, unknown>;

function requireTrimmed(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new PolymarketApiError(`${fieldName} is required.`);
  }
  return normalized;
}

function parseJsonArray<T>(
  value: unknown,
  coerce: (item: unknown) => T | null,
): T[] {
  const parseArray = (payload: unknown[]): T[] =>
    payload.map(coerce).filter((item): item is T => item !== null);

  if (Array.isArray(value)) {
    return parseArray(value);
  }

  if (typeof value !== "string" || value.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parseArray(parsed) : [];
  } catch {
    return [];
  }
}

function parseJsonStringArray(value: unknown): string[] {
  return parseJsonArray(value, (item) =>
    typeof item === "string" ? item : null,
  );
}

function parseJsonNumberArray(value: unknown): number[] {
  return parseJsonArray(value, asNumber);
}

export async function listMarkets(options: {
  params?: ListMarketsParams;
  gammaBaseUrl?: string;
  fetchFn?: FetchLike;
}): Promise<PolymarketMarket[]> {
  const {
    params,
    gammaBaseUrl = DEFAULT_GAMMA_BASE_URL,
    fetchFn = fetch,
  } = options;

  const url = buildUrl(gammaBaseUrl, "/markets", {
    limit: params?.limit,
    offset: params?.offset,
    order: params?.order,
    ascending: params?.ascending,
    closed: params?.closed,
    volume_num_min: params?.minVolume,
    liquidity_num_min: params?.minLiquidity,
  });

  const payload = await requestPolymarketJson<unknown>({ fetchFn, url });
  if (!Array.isArray(payload)) {
    throw new PolymarketApiError("Unexpected markets response format.");
  }

  return payload.filter(isRecord).map(normalizeMarket);
}

export async function getEventBySlug(options: {
  slug: string;
  gammaBaseUrl?: string;
  fetchFn?: FetchLike;
}): Promise<PolymarketEvent> {
  const {
    slug,
    gammaBaseUrl = DEFAULT_GAMMA_BASE_URL,
    fetchFn = fetch,
  } = options;

  const normalizedSlug = requireTrimmed(slug, "slug");

  const url = buildUrl(
    gammaBaseUrl,
    `/events/slug/${encodeURIComponent(normalizedSlug)}`,
  );
  const payload = await requestPolymarketJson<unknown>({ fetchFn, url });

  if (!isRecord(payload)) {
    throw new PolymarketApiError("Unexpected event response format.");
  }

  return normalizeEvent(payload);
}

export function normalizeMarket(payload: GammaMarketWire): PolymarketMarket {
  const events = Array.isArray(payload.events)
    ? payload.events.filter(isRecord)
    : [];
  const firstEvent = events.length > 0 ? events[0] : null;
  const firstEventId = firstEvent ? (asString(firstEvent.id) ?? null) : null;

  return {
    id: asString(payload.id) ?? "",
    conditionId: asString(payload.conditionId),
    slug: asString(payload.slug),
    question: asString(payload.question),
    eventId: firstEventId,
    outcomes: parseJsonStringArray(payload.outcomes),
    outcomePrices: parseJsonNumberArray(payload.outcomePrices),
    active: asBoolean(payload.active),
    closed: asBoolean(payload.closed),
    acceptingOrders: asBoolean(payload.acceptingOrders),
    endDate: asString(payload.endDateIso) ?? asString(payload.endDate),
    volume: asNumber(payload.volumeNum) ?? asNumber(payload.volume),
    volume24hr: asNumber(payload.volume24hr),
    liquidity: asNumber(payload.liquidityNum) ?? asNumber(payload.liquidity),
    bestBid: asNumber(payload.bestBid),
    bestAsk: asNumber(payload.bestAsk),
    spread: asNumber(payload.spread),
    clobTokenIds: parseJsonStringArray(payload.clobTokenIds),
  };
}

function normalizeEvent(payload: GammaEventWire): PolymarketEvent {
  const markets = Array.isArray(payload.markets)
    ? payload.markets.filter(isRecord).map(normalizeMarket)
    : [];

  return {
    id: asString(payload.id) ?? "",
    slug: asString(payload.slug),
    title: asString(payload.title),
    description: asString(payload.description),
    active: asBoolean(payload.active),
    closed: asBoolean(payload.closed),
    endDate: asString(payload.endDate),
    volume: asNumber(payload.volume),
    volume24hr: asNumber(payload.volume24hr),
    liquidity: asNumber(payload.liquidity),
    markets,
  };
}
