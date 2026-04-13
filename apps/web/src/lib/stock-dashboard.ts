import {
  getCashFlowSummary,
  type CashFlowSummarySection,
} from "@/lib/cash-flow-summary";
import { getFundamentalsSummary, type FundamentalsSummarySection } from "@/lib/fundamentals-summary";
import { getQuoteSummary, type QuoteSummarySection } from "@/lib/quote-summary";
import { resolveStockLookup } from "@/lib/stocks";

export type StockDashboardViewModel = {
  stock: Awaited<ReturnType<typeof resolveStockLookup>>;
  quote: QuoteSummarySection;
  fundamentals: FundamentalsSummarySection;
  cashFlow: CashFlowSummarySection;
};

export async function getStockDashboard(
  rawTicker: string,
): Promise<StockDashboardViewModel> {
  const stock = await resolveStockLookup(rawTicker);

  if (stock.status === "invalid" || stock.status === "unsupported") {
    return {
      stock,
      quote: {
        status: "empty",
        message: "Quote summary is unavailable for this ticker.",
        source: {
          provider: "alpaca",
          feed: "iex",
          referencePoint: "Previous daily bar close",
        },
      },
      fundamentals: {
        status: "empty",
        message: "Fundamentals are unavailable for this ticker.",
        earnings: {
          label: "Next earnings date",
          provider: "fmp",
          endpoint: "earnings",
          status: "unavailable",
          message: "Next earnings date is unavailable for this ticker.",
        },
        valuation: {
          label: "P/E ratio",
          provider: "fmp",
          endpoint: "ratios-ttm",
          status: "unavailable",
          message: "P/E ratio is unavailable for this ticker.",
        },
      },
      cashFlow: {
        status: "empty",
        message: "Cash-flow data is unavailable for this ticker.",
        periodRequested: "annual",
        metrics: [
          {
            key: "operatingCashFlow",
            label: "Operating cash flow",
            provider: "fmp",
            endpoint: "cash-flow-statement",
            status: "unavailable",
            message: "Operating cash flow is unavailable for this ticker.",
          },
          {
            key: "investingCashFlow",
            label: "Investing cash flow",
            provider: "fmp",
            endpoint: "cash-flow-statement",
            status: "unavailable",
            message: "Investing cash flow is unavailable for this ticker.",
          },
          {
            key: "financingCashFlow",
            label: "Financing cash flow",
            provider: "fmp",
            endpoint: "cash-flow-statement",
            status: "unavailable",
            message: "Financing cash flow is unavailable for this ticker.",
          },
          {
            key: "freeCashFlow",
            label: "Free cash flow",
            provider: "fmp",
            endpoint: "cash-flow-statement",
            status: "unavailable",
            message: "Free cash flow is unavailable for this ticker.",
          },
        ],
      },
    };
  }

  const [quote, fundamentals, cashFlow] = await Promise.all([
    getQuoteSummary(stock.ticker),
    getFundamentalsSummary(stock.ticker),
    getCashFlowSummary(stock.ticker),
  ]);

  return {
    stock,
    quote,
    fundamentals,
    cashFlow,
  };
}
