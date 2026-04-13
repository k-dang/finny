import { permanentRedirect } from "next/navigation";
import { StockDashboardShell } from "@/components/stock-dashboard-shell";
import { getStockDashboard } from "@/lib/stock-dashboard";
import { normalizeTickerInput } from "@/lib/stocks";

export default async function StockPage(props: {
  params: Promise<{ ticker: string }>;
}) {
  const params = await props.params;
  const normalizedTicker = normalizeTickerInput(params.ticker);

  if (normalizedTicker !== params.ticker) {
    permanentRedirect(`/stocks/${encodeURIComponent(normalizedTicker)}`);
  }

  const dashboard = await getStockDashboard(normalizedTicker);

  return (
    <StockDashboardShell
      cashFlow={dashboard.cashFlow}
      fundamentals={dashboard.fundamentals}
      quote={dashboard.quote}
      result={dashboard.stock}
    />
  );
}
