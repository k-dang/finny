import {
  getLatestPrices,
  getOptionChain,
  type AlpacaCredentials,
  type NormalizedOption,
  type NormalizedPrice,
} from "../../../../packages/alpaca/src/index.ts";
import { tool } from "@opencode-ai/plugin";

const MAX_SYMBOLS = 25;
const DEFAULT_OPTIONS_LIMIT = 100;
const MAX_OPTIONS_LIMIT = 200;

type AlpacaToolError = {
  ok: false;
  error: string;
};

type AlpacaPriceToolSuccess = {
  ok: true;
  symbols: string[];
  prices: Record<string, NormalizedPrice | null>;
  warnings: string[];
};

type AlpacaOptionsToolSuccess = {
  ok: true;
  underlying: string;
  contracts: NormalizedOption[];
};

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getCredentials(): AlpacaCredentials {
  const key = Bun.env.ALPACA_API_KEY;
  const secret = Bun.env.ALPACA_API_SECRET;

  if (!key || !secret) {
    throw new Error(
      "Missing credentials. Set ALPACA_API_KEY and ALPACA_API_SECRET.",
    );
  }

  return { key, secret };
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function normalizeSymbols(symbols: string[]): string[] {
  const normalized = symbols.map(normalizeSymbol).filter(Boolean);
  return Array.from(new Set(normalized));
}

export const price = tool({
  description:
    "Get latest read-only stock prices from Alpaca for one or more ticker symbols.",
  args: {
    symbols: tool.schema
      .array(
        tool.schema
          .string()
          .describe("Stock ticker symbol such as AAPL or TSLA."),
      )
      .describe("List of stock ticker symbols (max 25 unique values)."),
    feed: tool.schema
      .string()
      .optional()
      .describe(
        "Optional Alpaca feed name. Use iex by default unless a different feed is required.",
      ),
  },
  execute: async ({ symbols, feed }): Promise<string> => {
    try {
      const normalizedSymbols = normalizeSymbols(symbols);

      if (normalizedSymbols.length === 0) {
        throw new Error("Provide at least one valid symbol.");
      }

      if (normalizedSymbols.length > MAX_SYMBOLS) {
        throw new Error(`Too many symbols. Maximum is ${MAX_SYMBOLS}.`);
      }

      const credentials = getCredentials();
      const normalized = await getLatestPrices({
        symbols: normalizedSymbols,
        feed,
        credentials,
      });

      const prices: Record<string, NormalizedPrice | null> = {};
      const warnings: string[] = [];

      for (const symbol of normalizedSymbols) {
        if (normalized[symbol]) {
          prices[symbol] = normalized[symbol];
        } else {
          prices[symbol] = null;
          warnings.push(`No latest trade found for ${symbol}.`);
        }
      }

      const result: AlpacaPriceToolSuccess = {
        ok: true,
        symbols: normalizedSymbols,
        prices,
        warnings,
      };

      return JSON.stringify(result);
    } catch (error) {
      const result: AlpacaToolError = {
        ok: false,
        error: formatError(error),
      };

      return JSON.stringify(result);
    }
  },
});

export const options = tool({
  description:
    "Get a read-only Alpaca option chain snapshot for one underlying symbol.",
  args: {
    symbol: tool.schema
      .string()
      .describe("Underlying stock ticker symbol such as AAPL."),
    expiration: tool.schema
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Optional expiration date filter in YYYY-MM-DD format."),
    type: tool.schema
      .enum(["call", "put"])
      .optional()
      .describe("Optional option type filter."),
    limit: tool.schema
      .number()
      .int()
      .min(1)
      .max(MAX_OPTIONS_LIMIT)
      .optional()
      .describe("Maximum number of contracts to return (1-200)."),
  },
  execute: async ({ symbol, expiration, type, limit }): Promise<string> => {
    try {
      const normalizedSymbol = normalizeSymbol(symbol);

      if (!normalizedSymbol) {
        throw new Error("Provide a valid underlying symbol.");
      }

      const credentials = getCredentials();
      const contracts = await getOptionChain({
        underlying: normalizedSymbol,
        expiration,
        type,
        limit: limit ?? DEFAULT_OPTIONS_LIMIT,
        credentials,
      });

      const result: AlpacaOptionsToolSuccess = {
        ok: true,
        underlying: normalizedSymbol,
        contracts,
      };

      return JSON.stringify(result);
    } catch (error) {
      const result: AlpacaToolError = {
        ok: false,
        error: formatError(error),
      };

      return JSON.stringify(result);
    }
  },
});
