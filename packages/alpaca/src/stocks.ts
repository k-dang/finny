import { requestAlpacaJson } from "./http";
import type {
  AlpacaAsset,
  AlpacaCredentials,
  LatestTradesResponse,
  NormalizedAsset,
  NormalizedPrice,
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
