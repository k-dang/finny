import { getStockSnapshots, type NormalizedStockSnapshot } from "@repo/alpaca";
import { readAlpacaCredentials } from "@/lib/server/alpaca";
import { validateTickerInput } from "@/lib/stocks";

const QUOTE_PROVIDER = "alpaca";
const QUOTE_FEED = "iex";
const QUOTE_REFERENCE_POINT = "Previous daily bar close";
const QUOTE_INTRADAY_REFERENCE_POINT = "Current daily bar open";

type QuoteSourceContext = {
  provider: typeof QUOTE_PROVIDER;
  feed: typeof QUOTE_FEED;
  referencePoint: string;
};

type QuoteSectionBase = {
  source: QuoteSourceContext;
};

export type QuoteSummarySection =
  | (QuoteSectionBase & {
      status: "success" | "partial";
      currentPrice: number;
      updatedAt: string;
      exchange?: string;
      priceChange?: number;
      percentChange?: number;
      message?: string;
    })
  | (QuoteSectionBase & {
      status: "empty" | "error";
      message: string;
    });

function createSourceContext(): QuoteSourceContext {
  return {
    provider: QUOTE_PROVIDER,
    feed: QUOTE_FEED,
    referencePoint: QUOTE_REFERENCE_POINT,
  };
}

function createIntradaySourceContext(): QuoteSourceContext {
  return {
    provider: QUOTE_PROVIDER,
    feed: QUOTE_FEED,
    referencePoint: QUOTE_INTRADAY_REFERENCE_POINT,
  };
}

function createQuoteError(message: string): QuoteSummarySection {
  return {
    status: "error",
    message,
    source: createSourceContext(),
  };
}

function createQuoteEmpty(message: string): QuoteSummarySection {
  return {
    status: "empty",
    message,
    source: createSourceContext(),
  };
}

export function buildQuoteSummaryFromSnapshot(
  ticker: string,
  snapshot?: NormalizedStockSnapshot,
): QuoteSummarySection {
  const latestTrade = snapshot?.latestTrade;
  const dailyBar = snapshot?.dailyBar;
  const currentPrice =
    typeof latestTrade?.price === "number" && Number.isFinite(latestTrade.price)
      ? latestTrade.price
      : typeof dailyBar?.c === "number" && Number.isFinite(dailyBar.c)
        ? dailyBar.c
        : undefined;
  const updatedAt = latestTrade?.timestamp ?? dailyBar?.t;

  if (typeof currentPrice !== "number" || !updatedAt) {
    return createQuoteEmpty(`No live quote was returned for ${ticker}.`);
  }

  const previousClose = snapshot?.previousDailyBar?.c;

  if (typeof previousClose !== "number" || !Number.isFinite(previousClose)) {
    const dailyOpen = dailyBar?.o;

    if (typeof dailyOpen === "number" && Number.isFinite(dailyOpen) && dailyOpen !== 0) {
      const priceChange = currentPrice - dailyOpen;
      const percentChange = (priceChange / dailyOpen) * 100;

      return {
        status: "partial",
        currentPrice,
        updatedAt,
        exchange: latestTrade?.exchange,
        priceChange,
        percentChange,
        message:
          "Previous close was unavailable, so daily movement is using the current session open instead.",
        source: createIntradaySourceContext(),
      };
    }

    return {
      status: "partial",
      currentPrice,
      updatedAt,
      exchange: latestTrade?.exchange,
      message:
        "Current price is available, but the previous close reference was unavailable for daily movement.",
      source: createSourceContext(),
    };
  }

  if (previousClose === 0) {
    return {
      status: "partial",
      currentPrice,
      updatedAt,
      exchange: latestTrade?.exchange,
      message:
        "Current price is available, but the previous close was zero so daily percent change could not be calculated.",
      source: createSourceContext(),
    };
  }

  const priceChange = currentPrice - previousClose;
  const percentChange = (priceChange / previousClose) * 100;

  return {
    status: "success",
    currentPrice,
    updatedAt,
    exchange: latestTrade?.exchange,
    priceChange,
    percentChange,
    source: createSourceContext(),
  };
}

export async function getQuoteSummary(ticker: string): Promise<QuoteSummarySection> {
  const validation = validateTickerInput(ticker);

  if (!validation.valid) {
    return createQuoteEmpty(validation.message);
  }

  const credentials = readAlpacaCredentials();

  if (!credentials) {
    return createQuoteError(
      "Quote data is unavailable because Alpaca credentials are missing.",
    );
  }

  try {
    const snapshots = await getStockSnapshots({
      symbols: [ticker],
      feed: QUOTE_FEED,
      credentials,
    });

    return buildQuoteSummaryFromSnapshot(ticker, snapshots[ticker]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return createQuoteError(
      `Quote data is temporarily unavailable from Alpaca. ${message}`,
    );
  }
}
