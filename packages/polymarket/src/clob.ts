import {
  asBoolean,
  asNumber,
  asString,
  buildUrl,
  isRecord,
  PolymarketApiError,
  requestPolymarketJson,
} from "./http";
import type {
  FetchLike,
  PolymarketOrderLevel,
  PolymarketOrderbookSummary,
} from "./types";

const DEFAULT_CLOB_BASE_URL = "https://clob.polymarket.com";

export async function getOrderbookSummary(options: {
  tokenId: string;
  fetchFn?: FetchLike;
}): Promise<PolymarketOrderbookSummary> {
  const { tokenId, fetchFn = fetch } = options;

  const normalizedTokenId = tokenId.trim();
  if (!normalizedTokenId) {
    throw new PolymarketApiError("tokenId is required.");
  }

  const url = buildUrl(DEFAULT_CLOB_BASE_URL, "/book", {
    token_id: normalizedTokenId,
  });

  const payload = await requestPolymarketJson<unknown>({ fetchFn, url });
  if (!isRecord(payload)) {
    throw new PolymarketApiError("Unexpected orderbook response format.");
  }

  const bids = normalizeOrderLevels(payload.bids);
  const asks = normalizeOrderLevels(payload.asks);

  const [topBid] = bids;
  const [topAsk] = asks;

  return {
    market: asString(payload.market) ?? "",
    assetId: asString(payload.asset_id) ?? normalizedTokenId,
    timestamp: asString(payload.timestamp) ?? new Date().toISOString(),
    hash: asString(payload.hash) ?? "",
    bids,
    asks,
    bestBid: topBid ? topBid.price : null,
    bestAsk: topAsk ? topAsk.price : null,
    minOrderSize: asNumber(payload.min_order_size),
    tickSize: asNumber(payload.tick_size),
    negRisk: asBoolean(payload.neg_risk),
  };
}

function normalizeOrderLevels(payload: unknown): PolymarketOrderLevel[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const levels: PolymarketOrderLevel[] = [];

  for (const entry of payload) {
    if (!isRecord(entry)) {
      continue;
    }

    const price = asNumber(entry.price);
    const size = asNumber(entry.size);
    if (price === null || size === null) {
      continue;
    }

    levels.push({ price, size });
  }

  return levels;
}
