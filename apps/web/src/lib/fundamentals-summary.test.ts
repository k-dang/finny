import { describe, expect, it } from "vitest";
import { buildFundamentalsSummary } from "@/lib/fundamentals-summary";

describe("buildFundamentalsSummary", () => {
  it("maps the next upcoming earnings date and trailing pe ratio", () => {
    expect(
      buildFundamentalsSummary({
        ticker: "AAPL",
        now: new Date("2026-04-12T00:00:00Z"),
        earningsResult: {
          data: {
            AAPL: [
              { date: "2026-01-30" },
              { date: "2026-05-01" },
              { date: "2026-07-30" },
            ],
          },
          error: false,
          provenance: [
            {
              provider: "fmp",
              ticker: "AAPL",
              url: "https://financialmodelingprep.com/stable/earnings?symbol=AAPL",
              retrievedAt: "2026-04-12T12:00:00Z",
              asOfDate: "2026-05-01",
            },
          ],
        },
        ratiosResult: {
          data: {
            AAPL: {
              periodRequested: "ttm",
              periodResolved: "ttm",
              records: [{ priceToEarningsRatioTTM: 28.125 }],
            },
          },
          error: false,
          provenance: [
            {
              provider: "fmp",
              ticker: "AAPL",
              url: "https://financialmodelingprep.com/stable/ratios-ttm?symbol=AAPL",
              retrievedAt: "2026-04-12T12:00:01Z",
              asOfDate: "2025-12-31",
            },
          ],
        },
      }),
    ).toEqual({
      status: "success",
      message: "Fundamentals loaded successfully from FMP.",
      earnings: {
        label: "Next earnings date",
        provider: "fmp",
        endpoint: "earnings",
        status: "available",
        value: "2026-05-01T00:00:00.000Z",
        provenance: [
          {
            provider: "fmp",
            ticker: "AAPL",
            url: "https://financialmodelingprep.com/stable/earnings?symbol=AAPL",
            retrievedAt: "2026-04-12T12:00:00Z",
            asOfDate: "2026-05-01",
          },
        ],
        retrievedAt: "2026-04-12T12:00:00Z",
        asOfDate: "2026-05-01",
      },
      valuation: {
        label: "P/E ratio",
        provider: "fmp",
        endpoint: "ratios-ttm",
        status: "available",
        value: 28.125,
        provenance: [
          {
            provider: "fmp",
            ticker: "AAPL",
            url: "https://financialmodelingprep.com/stable/ratios-ttm?symbol=AAPL",
            retrievedAt: "2026-04-12T12:00:01Z",
            asOfDate: "2025-12-31",
          },
        ],
        retrievedAt: "2026-04-12T12:00:01Z",
        asOfDate: "2025-12-31",
      },
    });
  });

  it("returns a partial state when one fundamentals field is unavailable", () => {
    expect(
      buildFundamentalsSummary({
        ticker: "AAPL",
        now: new Date("2026-04-12T00:00:00Z"),
        earningsResult: {
          data: {
            AAPL: [{ date: "2026-05-01" }],
          },
          error: false,
        },
        ratiosResult: {
          data: {
            AAPL: {
              periodRequested: "ttm",
              periodResolved: "ttm",
              records: [{}],
            },
          },
          error: false,
        },
      }),
    ).toMatchObject({
      status: "partial",
      earnings: {
        status: "available",
      },
      valuation: {
        status: "unavailable",
        message: "No trailing P/E ratio is available for AAPL.",
      },
    });
  });

  it("returns an error state when both provider paths fail", () => {
    expect(
      buildFundamentalsSummary({
        ticker: "AAPL",
        earningsResult: {
          data: null,
          error: true,
          message: "earnings failed",
        },
        ratiosResult: {
          data: null,
          error: true,
          message: "ratios failed",
        },
      }),
    ).toMatchObject({
      status: "error",
      earnings: {
        status: "error",
        message: "earnings failed",
      },
      valuation: {
        status: "error",
        message: "ratios failed",
      },
    });
  });
});
