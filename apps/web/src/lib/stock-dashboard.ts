import { getFundamentalsSummary, type FundamentalsSummarySection } from "@/lib/fundamentals-summary";
import { getQuoteSummary, type QuoteSummarySection } from "@/lib/quote-summary";
import { resolveStockLookup } from "@/lib/stocks";

export type StockDashboardViewModel = {
  stock: Awaited<ReturnType<typeof resolveStockLookup>>;
  quote: QuoteSummarySection;
  fundamentals: FundamentalsSummarySection;
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
          endpoint: "earnings-calendar",
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
    };
  }

  const [quote, fundamentals] = await Promise.all([
    getQuoteSummary(stock.ticker),
    getFundamentalsSummary(stock.ticker),
  ]);

  return {
    stock,
    quote,
    fundamentals,
  };
}
