import { describe, expect, it } from "vitest";
import { buildQuoteSummaryFromSnapshot } from "@/lib/quote-summary";

describe("buildQuoteSummaryFromSnapshot", () => {
  it("computes daily move from the previous daily close", () => {
    expect(
      buildQuoteSummaryFromSnapshot("AAPL", {
        symbol: "AAPL",
        latestTrade: {
          symbol: "AAPL",
          price: 110,
          timestamp: "2024-01-15T15:59:59Z",
          exchange: "V",
        },
        previousDailyBar: {
          t: "2024-01-12T21:00:00Z",
          c: 100,
        },
      }),
    ).toEqual({
      status: "success",
      currentPrice: 110,
      updatedAt: "2024-01-15T15:59:59Z",
      exchange: "V",
      priceChange: 10,
      percentChange: 10,
      source: {
        provider: "alpaca",
        feed: "iex",
        referencePoint: "Previous daily bar close",
      },
    });
  });

  it("returns a partial state when the previous close is missing", () => {
    expect(
      buildQuoteSummaryFromSnapshot("AAPL", {
        symbol: "AAPL",
        latestTrade: {
          symbol: "AAPL",
          price: 110,
          timestamp: "2024-01-15T15:59:59Z",
        },
      }),
    ).toMatchObject({
      status: "partial",
      currentPrice: 110,
    });
  });

  it("falls back to the current daily open when the previous close is missing", () => {
    expect(
      buildQuoteSummaryFromSnapshot("AAPL", {
        symbol: "AAPL",
        latestTrade: {
          symbol: "AAPL",
          price: 110,
          timestamp: "2024-01-15T15:59:59Z",
        },
        dailyBar: {
          t: "2024-01-15T15:30:00Z",
          o: 105,
          c: 109,
        },
      }),
    ).toEqual({
      status: "partial",
      currentPrice: 110,
      updatedAt: "2024-01-15T15:59:59Z",
      exchange: undefined,
      priceChange: 5,
      percentChange: 4.761904761904762,
      message:
        "Previous close was unavailable, so daily movement is using the current session open instead.",
      source: {
        provider: "alpaca",
        feed: "iex",
        referencePoint: "Current daily bar open",
      },
    });
  });

  it("uses the daily bar close when the latest trade is missing", () => {
    expect(
      buildQuoteSummaryFromSnapshot("AAPL", {
        symbol: "AAPL",
        previousDailyBar: {
          t: "2024-01-12T21:00:00Z",
          c: 100,
        },
        dailyBar: {
          t: "2024-01-15T20:00:00Z",
          c: 110,
        },
      }),
    ).toEqual({
      status: "success",
      currentPrice: 110,
      updatedAt: "2024-01-15T20:00:00Z",
      exchange: undefined,
      priceChange: 10,
      percentChange: 10,
      source: {
        provider: "alpaca",
        feed: "iex",
        referencePoint: "Previous daily bar close",
      },
    });
  });

  it("returns an empty state when no latest trade is present", () => {
    expect(buildQuoteSummaryFromSnapshot("AAPL", { symbol: "AAPL" })).toEqual({
      status: "empty",
      message: "No live quote was returned for AAPL.",
      source: {
        provider: "alpaca",
        feed: "iex",
        referencePoint: "Previous daily bar close",
      },
    });
  });
});
