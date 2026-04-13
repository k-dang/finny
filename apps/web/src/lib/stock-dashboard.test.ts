import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStockDashboard } from "@/lib/stock-dashboard";

const {
  resolveStockLookupMock,
  getQuoteSummaryMock,
  getFundamentalsSummaryMock,
  getCashFlowSummaryMock,
} = vi.hoisted(() => ({
  resolveStockLookupMock: vi.fn(),
  getQuoteSummaryMock: vi.fn(),
  getFundamentalsSummaryMock: vi.fn(),
  getCashFlowSummaryMock: vi.fn(),
}));

vi.mock("@/lib/stocks", () => ({
  resolveStockLookup: resolveStockLookupMock,
}));

vi.mock("@/lib/quote-summary", () => ({
  getQuoteSummary: getQuoteSummaryMock,
}));

vi.mock("@/lib/fundamentals-summary", () => ({
  getFundamentalsSummary: getFundamentalsSummaryMock,
}));

vi.mock("@/lib/cash-flow-summary", () => ({
  getCashFlowSummary: getCashFlowSummaryMock,
}));

describe("getStockDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns section-level empty states for invalid tickers without fetching downstream data", async () => {
    resolveStockLookupMock.mockResolvedValue({
      status: "invalid",
      ticker: "UNKNOWN",
      message: "Enter a valid U.S. stock ticker, like AAPL or BRK.B.",
    });

    await expect(getStockDashboard("bad ticker")).resolves.toMatchObject({
      stock: {
        status: "invalid",
        ticker: "UNKNOWN",
      },
      quote: {
        status: "empty",
      },
      fundamentals: {
        status: "empty",
      },
      cashFlow: {
        status: "empty",
      },
    });

    expect(getQuoteSummaryMock).not.toHaveBeenCalled();
    expect(getFundamentalsSummaryMock).not.toHaveBeenCalled();
    expect(getCashFlowSummaryMock).not.toHaveBeenCalled();
  });

  it("composes mixed section states when provider results partially succeed", async () => {
    resolveStockLookupMock.mockResolvedValue({
      status: "ready",
      ticker: "AAPL",
      companyName: "Apple Inc.",
      provider: "alpaca",
    });
    getQuoteSummaryMock.mockResolvedValue({
      status: "success",
      currentPrice: 211.3,
      updatedAt: "2026-04-12T13:00:00Z",
      priceChange: 1.2,
      percentChange: 0.57,
      source: {
        provider: "alpaca",
        feed: "iex",
        referencePoint: "Previous daily bar close",
      },
    });
    getFundamentalsSummaryMock.mockResolvedValue({
      status: "partial",
      message: "p/e ratio is unavailable or degraded for AAPL.",
      earnings: {
        label: "Next earnings date",
        provider: "fmp",
        endpoint: "earnings",
        status: "available",
        value: "2026-05-01T00:00:00.000Z",
      },
      valuation: {
        label: "P/E ratio",
        provider: "fmp",
        endpoint: "ratios-ttm",
        status: "unavailable",
        message: "No trailing P/E ratio is available for AAPL.",
      },
    });
    getCashFlowSummaryMock.mockResolvedValue({
      status: "error",
      message: "Cash-flow data is unavailable because the provider request failed.",
      periodRequested: "annual",
      metrics: [
        {
          key: "operatingCashFlow",
          label: "Operating cash flow",
          provider: "fmp",
          endpoint: "cash-flow-statement",
          status: "error",
          message: "provider failed",
        },
      ],
    });

    await expect(getStockDashboard("AAPL")).resolves.toMatchObject({
      stock: {
        status: "ready",
        ticker: "AAPL",
      },
      quote: {
        status: "success",
      },
      fundamentals: {
        status: "partial",
      },
      cashFlow: {
        status: "error",
      },
    });

    expect(getQuoteSummaryMock).toHaveBeenCalledWith("AAPL");
    expect(getFundamentalsSummaryMock).toHaveBeenCalledWith("AAPL");
    expect(getCashFlowSummaryMock).toHaveBeenCalledWith("AAPL");
  });
});
