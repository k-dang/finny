import {
  getLatestPrices,
  getOptionChain,
  type AlpacaCredentials,
  type NormalizedOption,
  type NormalizedPrice,
  type OptionType,
} from "@repo/alpaca";
import { jsonSchema, tool } from "ai";

const MAX_SYMBOLS = 25;
const DEFAULT_OPTIONS_LIMIT = 100;
const MAX_OPTIONS_LIMIT = 200;

type AlpacaPriceToolInput = {
  symbols: string[];
  feed?: string;
};

type AlpacaOptionsToolInput = {
  symbol: string;
  expiration?: string;
  type?: OptionType;
  limit?: number;
};

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
  const key = process.env.ALPACA_API_KEY;
  const secret = process.env.ALPACA_API_SECRET;

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

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export const alpacaTools = {
  alpaca_price: tool({
    description:
      "Get latest read-only stock prices from Alpaca for one or more ticker symbols.",
    inputSchema: jsonSchema<AlpacaPriceToolInput>({
      type: "object",
      properties: {
        symbols: {
          type: "array",
          description:
            "List of stock ticker symbols such as AAPL or TSLA (max 25).",
          minItems: 1,
          maxItems: MAX_SYMBOLS,
          items: { type: "string" },
        },
        feed: {
          type: "string",
          description:
            "Optional Alpaca feed name. Use iex by default unless a different feed is required.",
        },
      },
      required: ["symbols"],
      additionalProperties: false,
    }),
    execute: async ({
      symbols,
      feed,
    }): Promise<AlpacaPriceToolSuccess | AlpacaToolError> => {
      try {
        const normalizedSymbols = normalizeSymbols(symbols);

        if (normalizedSymbols.length === 0) {
          return {
            ok: false,
            error: "Provide at least one valid symbol.",
          };
        }

        if (normalizedSymbols.length > MAX_SYMBOLS) {
          return {
            ok: false,
            error: `Too many symbols. Maximum is ${MAX_SYMBOLS}.`,
          };
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

        return {
          ok: true,
          symbols: normalizedSymbols,
          prices,
          warnings,
        };
      } catch (error) {
        return {
          ok: false,
          error: formatError(error),
        };
      }
    },
  }),

  alpaca_options: tool({
    description:
      "Get a read-only Alpaca option chain snapshot for one underlying symbol.",
    inputSchema: jsonSchema<AlpacaOptionsToolInput>({
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Underlying stock ticker symbol such as AAPL.",
        },
        expiration: {
          type: "string",
          description: "Optional expiration date filter in YYYY-MM-DD format.",
        },
        type: {
          type: "string",
          enum: ["call", "put"],
          description: "Optional option type filter.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: MAX_OPTIONS_LIMIT,
          description: "Maximum number of contracts to return (1-200).",
        },
      },
      required: ["symbol"],
      additionalProperties: false,
    }),
    execute: async ({
      symbol,
      expiration,
      type,
      limit,
    }): Promise<AlpacaOptionsToolSuccess | AlpacaToolError> => {
      try {
        const underlying = normalizeSymbol(symbol);
        if (!underlying) {
          return {
            ok: false,
            error: "Provide a valid underlying symbol.",
          };
        }

        if (expiration && !isIsoDate(expiration)) {
          return {
            ok: false,
            error: "expiration must use YYYY-MM-DD format.",
          };
        }

        const credentials = getCredentials();
        const contracts = await getOptionChain({
          underlying,
          expiration,
          type,
          limit: limit ?? DEFAULT_OPTIONS_LIMIT,
          credentials,
        });

        return {
          ok: true,
          underlying,
          contracts,
        };
      } catch (error) {
        return {
          ok: false,
          error: formatError(error),
        };
      }
    },
  }),
};
