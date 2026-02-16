import {
  getLatestPrices,
  getOptionChain,
  type AlpacaCredentials,
  type NormalizedOption,
  type NormalizedPrice,
} from "@repo/alpaca";
import { tool } from "ai";
import { z } from "zod";

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

const alpacaPriceInputSchema = z
  .object({
    symbols: z
      .array(z.string().describe("Stock ticker symbol such as AAPL or TSLA."))
      .describe("List of stock ticker symbols (max 25 unique values).")
      .transform(normalizeSymbols)
      .superRefine((symbols, ctx) => {
        if (symbols.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Provide at least one valid symbol.",
          });
        }

        if (symbols.length > MAX_SYMBOLS) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Too many symbols. Maximum is ${MAX_SYMBOLS}.`,
          });
        }
      }),
    feed: z
      .string()
      .optional()
      .describe(
        "Optional Alpaca feed name. Use iex by default unless a different feed is required.",
      ),
  })
  .strict();

const alpacaOptionsInputSchema = z
  .object({
    symbol: z
      .string()
      .describe("Underlying stock ticker symbol such as AAPL.")
      .transform(normalizeSymbol)
      .refine(Boolean, {
        message: "Provide a valid underlying symbol.",
      }),
    expiration: z
      .string()
      .optional()
      .describe("Optional expiration date filter in YYYY-MM-DD format.")
      .refine(
        (value) => value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value),
        {
          message: "expiration must use YYYY-MM-DD format.",
        },
      ),
    type: z
      .enum(["call", "put"])
      .optional()
      .describe("Optional option type filter."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_OPTIONS_LIMIT)
      .optional()
      .describe("Maximum number of contracts to return (1-200)."),
  })
  .strict();

export const alpacaTools = {
  alpaca_price: tool({
    description:
      "Get latest read-only stock prices from Alpaca for one or more ticker symbols.",
    inputSchema: alpacaPriceInputSchema,
    execute: async ({
      symbols,
      feed,
    }): Promise<AlpacaPriceToolSuccess | AlpacaToolError> => {
      try {
        const credentials = getCredentials();
        const normalized = await getLatestPrices({
          symbols,
          feed,
          credentials,
        });

        const prices: Record<string, NormalizedPrice | null> = {};
        const warnings: string[] = [];

        for (const symbol of symbols) {
          if (normalized[symbol]) {
            prices[symbol] = normalized[symbol];
          } else {
            prices[symbol] = null;
            warnings.push(`No latest trade found for ${symbol}.`);
          }
        }

        return {
          ok: true,
          symbols,
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
    inputSchema: alpacaOptionsInputSchema,
    execute: async ({
      symbol,
      expiration,
      type,
      limit,
    }): Promise<AlpacaOptionsToolSuccess | AlpacaToolError> => {
      try {
        const credentials = getCredentials();
        const contracts = await getOptionChain({
          underlying: symbol,
          expiration,
          type,
          limit: limit ?? DEFAULT_OPTIONS_LIMIT,
          credentials,
        });

        return {
          ok: true,
          underlying: symbol,
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
