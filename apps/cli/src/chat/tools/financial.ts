import {
  fetchFmpEstimates,
  fetchFmpFundamentals,
  fetchFmpInsiderTrades,
  fetchFmpRatios,
  fetchFmpSegments,
  listSecFilings,
  readSecFilingItems,
} from "@repo/finance-core";
import { tool } from "ai";
import { z } from "zod";

const DEFAULT_LIMIT = 4;
const DEFAULT_FILINGS_LIMIT = 5;
const DEFAULT_MAX_CHARS = 12_000;

function normalizeTicker(input: string): string {
  return input.trim().toUpperCase();
}

const tickerSchema = z
  .string()
  .transform(normalizeTicker)
  .refine(Boolean, { message: "ticker is required." })
  .describe("Ticker symbol such as AAPL or MSFT.");

const periodSchema = z
  .enum(["annual", "quarterly", "ttm"])
  .default("ttm")
  .describe("Financial period. Defaults to ttm.");

const fmpLimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(20)
  .default(DEFAULT_LIMIT)
  .describe("Maximum records to return (1-20).");

const secFilingTypesSchema = z
  .array(z.enum(["10-K", "10-Q", "8-K"]))
  .optional()
  .describe("Optional filing type filter.");

const financialFundamentalsInputSchema = z
  .object({
    ticker: tickerSchema,
    period: periodSchema,
    limit: fmpLimitSchema,
  })
  .strict();

const financialRatiosInputSchema = z
  .object({
    ticker: tickerSchema,
    period: periodSchema,
    limit: fmpLimitSchema,
  })
  .strict();

const financialEstimatesInputSchema = z
  .object({
    ticker: tickerSchema,
    limit: fmpLimitSchema,
  })
  .strict();

const financialInsiderTradesInputSchema = z
  .object({
    ticker: tickerSchema,
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(100)
      .describe("Maximum insider trades to return (1-100)."),
  })
  .strict();

const financialSegmentsInputSchema = z
  .object({
    ticker: tickerSchema,
    period: z
      .enum(["annual", "quarterly"])
      .default("annual")
      .describe("Segment data period."),
    limit: fmpLimitSchema,
  })
  .strict();

const financialFilingsListInputSchema = z
  .object({
    ticker: tickerSchema,
    filingTypes: secFilingTypesSchema,
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(25)
      .default(DEFAULT_FILINGS_LIMIT)
      .describe("Maximum filings to return (1-25)."),
  })
  .strict();

const financialFilingReadItemsInputSchema = z
  .object({
    ticker: tickerSchema,
    filingType: z
      .enum(["10-K", "10-Q", "8-K"])
      .describe("Filing type containing the target accession number."),
    accessionNumber: z
      .string()
      .trim()
      .min(1)
      .describe("SEC accession number for the filing to read."),
    items: z
      .array(z.string().trim().min(1))
      .optional()
      .describe("Optional SEC item markers, for example Item-1A or Item-7."),
    maxChars: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(100_000)
      .default(DEFAULT_MAX_CHARS)
      .describe("Maximum characters to return for excerpts."),
  })
  .strict();

export const financialTools = {
  financial_fundamentals: tool({
    description:
      "Fetch financial statements (income, balance sheet, cash flow) for one ticker from FMP. If period=ttm, FMP quarter mode is used and returns recent quarterly statements.",
    inputSchema: financialFundamentalsInputSchema,
    execute: async ({ ticker, period, limit }) => {
      return fetchFmpFundamentals({
        ticker,
        period,
        limit,
        apiKey: process.env.FMP_API_KEY,
      });
    },
  }),

  financial_ratios: tool({
    description:
      "Fetch valuation and quality ratio records for one ticker from FMP.",
    inputSchema: financialRatiosInputSchema,
    execute: async ({ ticker, period, limit }) => {
      return fetchFmpRatios({
        ticker,
        period,
        limit,
        apiKey: process.env.FMP_API_KEY,
      });
    },
  }),

  financial_estimates: tool({
    description: "Fetch analyst estimate records for one ticker from FMP.",
    inputSchema: financialEstimatesInputSchema,
    execute: async ({ ticker, limit }) => {
      return fetchFmpEstimates({
        ticker,
        limit,
        apiKey: process.env.FMP_API_KEY,
      });
    },
  }),

  financial_insider_trades: tool({
    description: "Fetch insider trading records for one ticker from FMP.",
    inputSchema: financialInsiderTradesInputSchema,
    execute: async ({ ticker, limit }) => {
      return fetchFmpInsiderTrades({
        ticker,
        limit,
        apiKey: process.env.FMP_API_KEY,
      });
    },
  }),

  financial_segments: tool({
    description: "Fetch segment revenue history for one ticker from FMP.",
    inputSchema: financialSegmentsInputSchema,
    execute: async ({ ticker, period, limit }) => {
      return fetchFmpSegments({
        ticker,
        period,
        limit,
        apiKey: process.env.FMP_API_KEY,
      });
    },
  }),

  financial_filings_list: tool({
    description:
      "List recent SEC filings for one ticker, optionally filtered by filing type.",
    inputSchema: financialFilingsListInputSchema,
    execute: async ({ ticker, filingTypes, limit }) => {
      return listSecFilings({
        ticker,
        filingTypes,
        limit,
      });
    },
  }),

  financial_filing_read_items: tool({
    description:
      "Read selected SEC filing items for one ticker and accession number.",
    inputSchema: financialFilingReadItemsInputSchema,
    execute: async ({
      ticker,
      filingType,
      accessionNumber,
      items,
      maxChars,
    }) => {
      return readSecFilingItems({
        ticker,
        filingType,
        accessionNumber,
        items,
        maxChars,
      });
    },
  }),
};
