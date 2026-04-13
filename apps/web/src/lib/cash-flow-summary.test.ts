import { describe, expect, it } from "vitest";
import { buildCashFlowSummary } from "@/lib/cash-flow-summary";

describe("buildCashFlowSummary", () => {
  it("maps compact cash-flow metrics from the latest statement and preserves zeroes", () => {
    expect(
      buildCashFlowSummary({
        ticker: "AAPL",
        fundamentalsResult: {
          data: {
            AAPL: {
              periodRequested: "annual",
              periodResolved: "annual",
              incomeStatements: [],
              balanceSheets: [],
              cashFlowStatements: [
                {
                  date: "2025-12-31",
                  netCashProvidedByOperatingActivities: 125_000_000,
                  netCashProvidedByInvestingActivities: -48_000_000,
                  netCashProvidedByFinancingActivities: 0,
                  freeCashFlow: 77_000_000,
                },
              ],
            },
          },
          error: false,
          provenance: [
            {
              provider: "fmp",
              ticker: "AAPL",
              url: "https://financialmodelingprep.com/stable/cash-flow-statement?symbol=AAPL",
              retrievedAt: "2026-04-12T13:00:00Z",
              asOfDate: "2025-12-31",
            },
          ],
        },
      }),
    ).toEqual({
      status: "success",
      message: "Cash-flow data loaded successfully from FMP fundamentals.",
      periodRequested: "annual",
      periodResolved: "annual",
      metrics: [
        {
          key: "operatingCashFlow",
          label: "Operating cash flow",
          provider: "fmp",
          endpoint: "cash-flow-statement",
          status: "available",
          value: 125_000_000,
          provenance: [
            {
              provider: "fmp",
              ticker: "AAPL",
              url: "https://financialmodelingprep.com/stable/cash-flow-statement?symbol=AAPL",
              retrievedAt: "2026-04-12T13:00:00Z",
              asOfDate: "2025-12-31",
            },
          ],
          retrievedAt: "2026-04-12T13:00:00Z",
          asOfDate: "2025-12-31",
        },
        {
          key: "investingCashFlow",
          label: "Investing cash flow",
          provider: "fmp",
          endpoint: "cash-flow-statement",
          status: "available",
          value: -48_000_000,
          provenance: [
            {
              provider: "fmp",
              ticker: "AAPL",
              url: "https://financialmodelingprep.com/stable/cash-flow-statement?symbol=AAPL",
              retrievedAt: "2026-04-12T13:00:00Z",
              asOfDate: "2025-12-31",
            },
          ],
          retrievedAt: "2026-04-12T13:00:00Z",
          asOfDate: "2025-12-31",
        },
        {
          key: "financingCashFlow",
          label: "Financing cash flow",
          provider: "fmp",
          endpoint: "cash-flow-statement",
          status: "available",
          value: 0,
          provenance: [
            {
              provider: "fmp",
              ticker: "AAPL",
              url: "https://financialmodelingprep.com/stable/cash-flow-statement?symbol=AAPL",
              retrievedAt: "2026-04-12T13:00:00Z",
              asOfDate: "2025-12-31",
            },
          ],
          retrievedAt: "2026-04-12T13:00:00Z",
          asOfDate: "2025-12-31",
        },
        {
          key: "freeCashFlow",
          label: "Free cash flow",
          provider: "fmp",
          endpoint: "cash-flow-statement",
          status: "available",
          value: 77_000_000,
          provenance: [
            {
              provider: "fmp",
              ticker: "AAPL",
              url: "https://financialmodelingprep.com/stable/cash-flow-statement?symbol=AAPL",
              retrievedAt: "2026-04-12T13:00:00Z",
              asOfDate: "2025-12-31",
            },
          ],
          retrievedAt: "2026-04-12T13:00:00Z",
          asOfDate: "2025-12-31",
        },
      ],
    });
  });

  it("returns a partial state when some cash-flow fields are unavailable", () => {
    expect(
      buildCashFlowSummary({
        ticker: "AAPL",
        fundamentalsResult: {
          data: {
            AAPL: {
              periodRequested: "annual",
              periodResolved: "annual",
              incomeStatements: [],
              balanceSheets: [],
              cashFlowStatements: [
                {
                  date: "2025-12-31",
                  operatingCashFlow: 125_000_000,
                  freeCashFlow: 77_000_000,
                },
              ],
            },
          },
          error: false,
        },
      }),
    ).toMatchObject({
      status: "partial",
      metrics: [
        { key: "operatingCashFlow", status: "available" },
        {
          key: "investingCashFlow",
          status: "unavailable",
          message: "Investing cash flow is unavailable for AAPL.",
        },
        {
          key: "financingCashFlow",
          status: "unavailable",
          message: "Financing cash flow is unavailable for AAPL.",
        },
        { key: "freeCashFlow", status: "available" },
      ],
    });
  });

  it("returns an error state when the provider request fails", () => {
    expect(
      buildCashFlowSummary({
        ticker: "AAPL",
        fundamentalsResult: {
          data: null,
          error: true,
          message: "cash flow failed",
        },
      }),
    ).toMatchObject({
      status: "error",
      metrics: [
        { key: "operatingCashFlow", status: "error", message: "cash flow failed" },
        { key: "investingCashFlow", status: "error", message: "cash flow failed" },
        { key: "financingCashFlow", status: "error", message: "cash flow failed" },
        { key: "freeCashFlow", status: "error", message: "cash flow failed" },
      ],
    });
  });
});
