import { getAsset } from "@repo/alpaca";
import { readAlpacaCredentials } from "@/lib/server/alpaca";

const TICKER_PATTERN = /^(?:[A-Z]{1,5}|[A-Z]{1,4}[.-][A-Z])$/;

type ReadyStockLookupResult = {
  status: "ready";
  ticker: string;
  companyName?: string;
  exchange?: string;
  provider: "alpaca";
};

type InvalidStockLookupResult = {
  status: "invalid";
  ticker: string;
  message: string;
};

type UnsupportedStockLookupResult = {
  status: "unsupported";
  ticker: string;
  message: string;
};

type UnverifiedStockLookupResult = {
  status: "unverified";
  ticker: string;
  message: string;
};

export type StockLookupResult =
  | ReadyStockLookupResult
  | InvalidStockLookupResult
  | UnsupportedStockLookupResult
  | UnverifiedStockLookupResult;

export function normalizeTickerInput(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function validateTickerInput(
  ticker: string,
): { valid: true; ticker: string } | { valid: false; message: string } {
  if (!ticker) {
    return {
      valid: false,
      message: "Enter a ticker to open a stock dashboard.",
    };
  }

  if (!TICKER_PATTERN.test(ticker)) {
    return {
      valid: false,
      message: "Enter a valid U.S. stock ticker, like AAPL or BRK.B.",
    };
  }

  return { valid: true, ticker };
}

function isUnsupportedAssetError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("API error 404") || message.includes("API error 422");
}

function unsupportedMessage(ticker: string): string {
  return `${ticker} is outside the v1 coverage set. Only active U.S.-listed equities are supported right now.`;
}

export async function resolveTickerInput(rawTicker: string): Promise<{
  status: "ready" | "invalid" | "unsupported" | "unverified";
  ticker: string;
  message?: string;
}> {
  const ticker = normalizeTickerInput(rawTicker);
  const validation = validateTickerInput(ticker);

  if (!validation.valid) {
    return {
      status: "invalid",
      ticker,
      message: validation.message,
    };
  }

  const credentials = readAlpacaCredentials();
  if (!credentials) {
    return {
      status: "unverified",
      ticker,
      message:
        "Ticker verification is unavailable because Alpaca credentials are missing.",
    };
  }

  try {
    const asset = await getAsset({ symbol: ticker, credentials });

    if (asset.assetClass !== "us_equity" || asset.status !== "active") {
      return {
        status: "unsupported",
        ticker,
        message: unsupportedMessage(ticker),
      };
    }

    return { status: "ready", ticker };
  } catch (error) {
    if (isUnsupportedAssetError(error)) {
      return {
        status: "unsupported",
        ticker,
        message: unsupportedMessage(ticker),
      };
    }

    return {
      status: "unverified",
      ticker,
      message:
        "Ticker verification is temporarily unavailable. You can still use the canonical stock URL, but coverage could not be confirmed.",
    };
  }
}

export async function resolveStockLookup(
  rawTicker: string,
): Promise<StockLookupResult> {
  const ticker = normalizeTickerInput(rawTicker);
  const validation = validateTickerInput(ticker);

  if (!validation.valid) {
    return {
      status: "invalid",
      ticker: ticker || "UNKNOWN",
      message: validation.message,
    };
  }

  const credentials = readAlpacaCredentials();
  if (!credentials) {
    return {
      status: "unverified",
      ticker,
      message:
        "Ticker verification is unavailable because Alpaca credentials are missing in this environment.",
    };
  }

  try {
    const asset = await getAsset({ symbol: ticker, credentials });

    if (asset.assetClass !== "us_equity" || asset.status !== "active") {
      return {
        status: "unsupported",
        ticker,
        message: unsupportedMessage(ticker),
      };
    }

    return {
      status: "ready",
      ticker,
      companyName: asset.name,
      exchange: asset.exchange,
      provider: "alpaca",
    };
  } catch (error) {
    if (isUnsupportedAssetError(error)) {
      return {
        status: "unsupported",
        ticker,
        message: unsupportedMessage(ticker),
      };
    }

    return {
      status: "unverified",
      ticker,
      message:
        "Ticker verification is temporarily unavailable. This URL remains stable, but coverage and company identity could not be confirmed.",
    };
  }
}
