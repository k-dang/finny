import { requestAlpacaJson } from "./http";
import type {
  AlpacaAsset,
  AlpacaCredentials,
  StockSnapshotsResponse,
  LatestTradesResponse,
  NormalizedAsset,
  NormalizedPrice,
  NormalizedStockSnapshot,
} from "./types";

const DEFAULT_STOCKS_DATA_BASE_URL = "https://data.alpaca.markets/v2";
const DEFAULT_TRADING_BASE_URL = "https://paper-api.alpaca.markets/v2";

export type GetLatestPricesParams = {
  symbols: string[];
  feed?: string;
  credentials: AlpacaCredentials;
  baseUrl?: string;
};

export type GetAssetParams = {
  symbol: string;
  credentials: AlpacaCredentials;
  baseUrl?: string;
};

export type GetStockSnapshotsParams = {
  symbols: string[];
  feed?: string;
  credentials: AlpacaCredentials;
  baseUrl?: string;
};

function buildLatestTradesUrl(
  symbols: string[],
  feed: string,
  baseUrl = DEFAULT_STOCKS_DATA_BASE_URL,
): string {
  const params = new URLSearchParams();
  params.set("symbols", symbols.join(","));
  params.set("feed", feed);
  return `${baseUrl}/stocks/trades/latest?${params}`;
}

function buildAssetUrl(
  symbol: string,
  baseUrl = DEFAULT_TRADING_BASE_URL,
): string {
  return `${baseUrl}/assets/${encodeURIComponent(symbol)}`;
}

function buildSnapshotsUrl(
  symbols: string[],
  feed: string,
  baseUrl = DEFAULT_STOCKS_DATA_BASE_URL,
): string {
  const params = new URLSearchParams();
  params.set("symbols", symbols.join(","));
  params.set("feed", feed);
  return `${baseUrl}/stocks/snapshots?${params}`;
}

async function fetchLatestTrades(params: {
  symbols: string[];
  feed: string;
  credentials: AlpacaCredentials;
  baseUrl?: string;
}): Promise<LatestTradesResponse> {
  const { symbols, feed, credentials, baseUrl } = params;
  const url = buildLatestTradesUrl(symbols, feed, baseUrl);
  return requestAlpacaJson<LatestTradesResponse>(url, credentials);
}

async function fetchStockSnapshots(params: {
  symbols: string[];
  feed: string;
  credentials: AlpacaCredentials;
  baseUrl?: string;
}): Promise<StockSnapshotsResponse> {
  const { symbols, feed, credentials, baseUrl } = params;
  const url = buildSnapshotsUrl(symbols, feed, baseUrl);
  return requestAlpacaJson<StockSnapshotsResponse>(url, credentials);
}

export function normalizeLatestTrades(
  response: LatestTradesResponse,
): Record<string, NormalizedPrice> {
  const output: Record<string, NormalizedPrice> = {};

  for (const [symbol, trade] of Object.entries(response.trades ?? {})) {
    output[symbol] = {
      symbol,
      price: trade.p,
      timestamp: trade.t,
      exchange: trade.x,
    };
  }

  return output;
}

export function normalizeStockSnapshots(
  response: StockSnapshotsResponse,
): Record<string, NormalizedStockSnapshot> {
  const output: Record<string, NormalizedStockSnapshot> = {};

  for (const [symbol, snapshot] of Object.entries(response ?? {})) {
    output[symbol] = {
      symbol,
      latestTrade: snapshot.latestTrade
        ? {
            symbol,
            price: snapshot.latestTrade.p,
            timestamp: snapshot.latestTrade.t,
            exchange: snapshot.latestTrade.x,
          }
        : undefined,
      previousDailyBar: snapshot.previousDailyBar,
      dailyBar: snapshot.dailyBar,
    };
  }

  return output;
}

export function normalizeAsset(asset: AlpacaAsset): NormalizedAsset {
  return {
    symbol: asset.symbol,
    name: asset.name,
    exchange: asset.exchange,
    assetClass: asset.class,
    status: asset.status,
    tradable: asset.tradable ?? false,
  };
}

export async function getLatestPrices(
  params: GetLatestPricesParams,
): Promise<Record<string, NormalizedPrice>> {
  const { symbols, feed = "iex", credentials, baseUrl } = params;
  const response = await fetchLatestTrades({
    symbols,
    feed,
    credentials,
    baseUrl,
  });
  return normalizeLatestTrades(response);
}

export async function getAsset(
  params: GetAssetParams,
): Promise<NormalizedAsset> {
  const response = await requestAlpacaJson<AlpacaAsset>(
    buildAssetUrl(params.symbol, params.baseUrl),
    params.credentials,
  );

  return normalizeAsset(response);
}

export async function getStockSnapshots(
  params: GetStockSnapshotsParams,
): Promise<Record<string, NormalizedStockSnapshot>> {
  const { symbols, feed = "iex", credentials, baseUrl } = params;
  const response = await fetchStockSnapshots({
    symbols,
    feed,
    credentials,
    baseUrl,
  });

  return normalizeStockSnapshots(response);
}
