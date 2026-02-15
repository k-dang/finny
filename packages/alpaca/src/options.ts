import { requestAlpacaJson } from "./http";
import type {
  AlpacaCredentials,
  NormalizedOption,
  OptionChainResponse,
  OptionSnapshot,
  OptionType,
} from "./types";

const OPTIONS_DATA_BASE_URL = "https://data.alpaca.markets/v1beta1";

type OptionChainQuery = {
  expiration?: string;
  type?: OptionType;
  limit?: number;
};

export type GetOptionChainParams = {
  underlying: string;
  expiration?: string;
  type?: OptionType;
  limit?: number;
  credentials: AlpacaCredentials;
  baseUrl?: string;
};

function buildOptionChainUrl(
  underlying: string,
  options?: OptionChainQuery,
  baseUrl = OPTIONS_DATA_BASE_URL,
): string {
  const url = new URL(`${baseUrl}/options/snapshots/${underlying}`);

  if (options?.type) {
    url.searchParams.set("type", options.type);
  }

  if (options?.expiration) {
    url.searchParams.set("expiration_date", options.expiration);
  }

  if (options?.limit) {
    url.searchParams.set("limit", String(options.limit));
  }

  return url.toString();
}

async function fetchOptionChain(
  params: GetOptionChainParams,
): Promise<OptionChainResponse> {
  const { underlying, expiration, type, limit, credentials, baseUrl } = params;
  const url = buildOptionChainUrl(
    underlying,
    { expiration, type, limit },
    baseUrl,
  );
  return requestAlpacaJson<OptionChainResponse>(url, credentials);
}

function applySnapshotToOption(
  normalized: NormalizedOption,
  snapshot: OptionSnapshot,
): void {
  if (snapshot.latestQuote) {
    normalized.bid = snapshot.latestQuote.bp;
    normalized.ask = snapshot.latestQuote.ap;
  }

  if (snapshot.latestTrade) {
    normalized.lastPrice = snapshot.latestTrade.p;
  }

  if (snapshot.impliedVolatility !== undefined) {
    normalized.impliedVolatility = snapshot.impliedVolatility;
  }

  if (snapshot.greeks) {
    normalized.delta = snapshot.greeks.delta;
    normalized.gamma = snapshot.greeks.gamma;
    normalized.theta = snapshot.greeks.theta;
    normalized.vega = snapshot.greeks.vega;
  }
}

export function parseOptionSymbol(symbol: string): {
  underlying: string;
  expiration: string;
  type: OptionType;
  strike: number;
} | null {
  if (symbol.length < 16) {
    return null;
  }

  const suffixStart = symbol.length - 15;
  const underlying = symbol.slice(0, suffixStart);
  const dateStr = symbol.slice(suffixStart, suffixStart + 6);
  const typeChar = symbol.slice(suffixStart + 6, suffixStart + 7);
  const strikeStr = symbol.slice(suffixStart + 7);

  if (!/^\d{6}$/.test(dateStr) || !/^\d{8}$/.test(strikeStr)) {
    return null;
  }

  const type = typeChar === "C" ? "call" : typeChar === "P" ? "put" : null;
  if (!type) {
    return null;
  }

  const year = 2000 + parseInt(dateStr.slice(0, 2), 10);
  const month = dateStr.slice(2, 4);
  const day = dateStr.slice(4, 6);
  const expiration = `${year}-${month}-${day}`;
  const strike = parseInt(strikeStr, 10) / 1000;

  return { underlying, expiration, type, strike };
}

function sortNormalizedOptions(
  a: NormalizedOption,
  b: NormalizedOption,
): number {
  return (
    a.expiration.localeCompare(b.expiration) ||
    a.strike - b.strike ||
    a.type.localeCompare(b.type) ||
    a.symbol.localeCompare(b.symbol)
  );
}

export function normalizeOptionChainResponse(
  response: OptionChainResponse,
): NormalizedOption[] {
  const normalized: NormalizedOption[] = [];

  for (const [symbol, snapshot] of Object.entries(response.snapshots ?? {})) {
    const parsed = parseOptionSymbol(symbol);
    if (!parsed) {
      continue;
    }

    const option: NormalizedOption = {
      symbol,
      name: `${parsed.underlying} ${parsed.expiration} ${parsed.strike} ${parsed.type}`,
      underlying: parsed.underlying,
      type: parsed.type,
      strike: parsed.strike,
      expiration: parsed.expiration,
    };

    applySnapshotToOption(option, snapshot);
    normalized.push(option);
  }

  return normalized.sort(sortNormalizedOptions);
}

export async function getOptionChain(
  params: GetOptionChainParams,
): Promise<NormalizedOption[]> {
  const response = await fetchOptionChain(params);
  return normalizeOptionChainResponse(response);
}
