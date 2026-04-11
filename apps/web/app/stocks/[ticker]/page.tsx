import { permanentRedirect } from "next/navigation";
import { StockDashboardShell } from "@/components/stock-dashboard-shell";
import { normalizeTickerInput, resolveStockLookup } from "@/lib/stocks";

export default async function StockPage(
  props: PageProps<"/stocks/[ticker]">,
) {
  const params = await props.params;
  const normalizedTicker = normalizeTickerInput(params.ticker);

  if (normalizedTicker !== params.ticker) {
    permanentRedirect(`/stocks/${encodeURIComponent(normalizedTicker)}`);
  }

  const result = await resolveStockLookup(normalizedTicker);

  return <StockDashboardShell result={result} />;
}
