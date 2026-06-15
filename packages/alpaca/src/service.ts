import type {
  AlpacaCredentials,
  LatestTradesResponse,
  NormalizedOption,
  NormalizedPrice,
  OptionChainResponse,
  OptionSnapshot,
  OptionType,
} from "./types";
import { requestAlpacaJson, type AlpacaFetchFn } from "./http";

const DEFAULT_STOCKS_DATA_BASE_URL = "https://data.alpaca.markets/v2";
const DEFAULT_OPTIONS_DATA_BASE_URL = "https://data.alpaca.markets/v1beta1";
const DEFAULT_STOCK_FEED = "iex";
const DEFAULT_OPTION_LIMIT = 100;

export type AlpacaResult<T> =
  | { ok: true; data: T; warnings: string[] }
  | { ok: false; error: string };

export type LatestPricesPayload = {
  symbols: string[];
  prices: Record<string, NormalizedPrice | null>;
};

export type OptionChainPayload = {
  underlying: string;
  contracts: NormalizedOption[];
};

export type AlpacaMarketDataClient = {
  latestTrades(input: {
    symbols: string[];
    feed: string;
  }): Promise<LatestTradesResponse>;

  optionChain(input: {
    underlying: string;
    expiration?: string;
    type?: OptionType;
    limit?: number;
  }): Promise<OptionChainResponse>;
};

export type AlpacaMarketDataService = {
  latestPrices(input: {
    symbols: string[];
    feed?: string;
  }): Promise<AlpacaResult<LatestPricesPayload>>;

  optionChain(input: {
    underlying: string;
    expiration?: string;
    type?: OptionType;
    limit?: number;
  }): Promise<AlpacaResult<OptionChainPayload>>;
};

export function createAlpacaMarketDataService(options: {
  client: AlpacaMarketDataClient;
  defaults?: {
    stockFeed?: string;
    optionLimit?: number;
  };
}): AlpacaMarketDataService {
  const { client } = options;
  const stockFeed = options.defaults?.stockFeed ?? DEFAULT_STOCK_FEED;
  const optionLimit = options.defaults?.optionLimit ?? DEFAULT_OPTION_LIMIT;

  return {
    async latestPrices(input) {
      const symbols = normalizeSymbols(input.symbols);
      if (symbols.length === 0) {
        return { ok: false, error: "Provide at least one valid symbol." };
      }

      return withResult(async () => {
        const response = await client.latestTrades({
          symbols,
          feed: input.feed ?? stockFeed,
        });
        const normalized = normalizeLatestTrades(response);
        const prices: Record<string, NormalizedPrice | null> = {};
        const warnings: string[] = [];

        for (const symbol of symbols) {
          prices[symbol] = normalized[symbol] ?? null;
          if (!normalized[symbol]) {
            warnings.push(`No latest trade found for ${symbol}.`);
          }
        }

        return { symbols, prices, warnings };
      });
    },

    async optionChain(input) {
      const underlying = normalizeSymbol(input.underlying);
      if (!underlying) {
        return { ok: false, error: "Provide a valid underlying symbol." };
      }

      return withResult(async () => {
        const limit = input.limit ?? optionLimit;
        const response = await client.optionChain({
          underlying,
          expiration: input.expiration,
          type: input.type,
          limit,
        });

        const warnings: string[] = [];
        if (response.next_page_token) {
          warnings.push(
            `Option chain truncated at ${limit} contracts; more available.`,
          );
        }

        return {
          underlying,
          contracts: normalizeOptionChainResponse(response),
          warnings,
        };
      });
    },
  };
}

export function createAlpacaClient(options: {
  credentials: AlpacaCredentials;
  fetchFn?: AlpacaFetchFn;
}): AlpacaMarketDataClient {
  const fetchFn = options.fetchFn ?? fetch;

  const requestJson = <T>(url: string): Promise<T> =>
    requestAlpacaJson<T>(url, options.credentials, fetchFn);

  return {
    latestTrades(input) {
      const params = new URLSearchParams();
      params.set("symbols", input.symbols.join(","));
      params.set("feed", input.feed);
      return requestJson<LatestTradesResponse>(
        `${DEFAULT_STOCKS_DATA_BASE_URL}/stocks/trades/latest?${params}`,
      );
    },

    optionChain(input) {
      const url = new URL(
        `${DEFAULT_OPTIONS_DATA_BASE_URL}/options/snapshots/${input.underlying}`,
      );

      if (input.type) {
        url.searchParams.set("type", input.type);
      }

      if (input.expiration) {
        url.searchParams.set("expiration_date", input.expiration);
      }

      if (input.limit) {
        url.searchParams.set("limit", String(input.limit));
      }

      return requestJson<OptionChainResponse>(url.toString());
    },
  };
}

function normalizeSymbols(symbols: string[]): string[] {
  return Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean)));
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function normalizeLatestTrades(
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

function parseOptionSymbol(symbol: string): {
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
    normalized.rho = snapshot.greeks.rho;
  }
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

function normalizeOptionChainResponse(
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

async function withResult<T>(
  operation: () => Promise<T & { warnings: string[] }>,
): Promise<AlpacaResult<Omit<T, "warnings">>> {
  try {
    const { warnings, ...data } = await operation();
    return { ok: true, data, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}
