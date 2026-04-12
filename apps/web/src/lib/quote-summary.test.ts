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
