import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { StockCashFlowSummary } from "@/components/stock-cash-flow-summary";
import { StockFundamentalsSummary } from "@/components/stock-fundamentals-summary";
import { StockQuoteSummary } from "@/components/stock-quote-summary";
import { StockStatusBanner } from "@/components/stock-status-banner";
import { TickerSearchForm } from "@/components/ticker-search-form";
import type { CashFlowSummarySection } from "@/lib/cash-flow-summary";
import type { FundamentalsSummarySection } from "@/lib/fundamentals-summary";
import type { QuoteSummarySection } from "@/lib/quote-summary";
import type { StockLookupResult } from "@/lib/stocks";

type StockDashboardShellProps = {
  result: StockLookupResult;
  quote: QuoteSummarySection;
  fundamentals: FundamentalsSummarySection;
  cashFlow: CashFlowSummarySection;
};

export function StockDashboardShell(props: StockDashboardShellProps) {
  const title =
    props.result.status === "ready" && props.result.companyName
      ? props.result.companyName
      : props.result.ticker;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f4f1e8_0%,_#fffdf8_38%,_#eef6f3_100%)] px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-teal-900"
            href="/"
          >
            <ArrowLeft className="size-4" />
            Back to search
          </Link>
          <div className="rounded-full border border-slate-900/10 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-600">
            V1 coverage: U.S.-listed equities
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-900/15 bg-teal-900/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-teal-900">
              <Building2 className="size-3.5" />
              /stocks/{props.result.ticker}
            </div>
            <div className="space-y-3">
              <p className="font-mono text-sm uppercase tracking-[0.28em] text-slate-600">
                {props.result.ticker}
              </p>
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
                {title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-700">
                {props.result.status === "ready"
                  ? "The dashboard is now showing the full v1 slice: live quote context, upcoming earnings, trailing valuation, and compact cash-flow fields."
                  : props.result.status === "invalid"
                    ? "The route rendered a clear invalid-input state instead of a broken dashboard."
                    : "This route stays canonical even when data verification is limited, so the stock URL remains stable and shareable."}
              </p>
            </div>
            <StockStatusBanner result={props.result} />
          </div>
          <TickerSearchForm compact />
        </section>

        <StockQuoteSummary quote={props.quote} ticker={props.result.ticker} />
        <StockFundamentalsSummary
          fundamentals={props.fundamentals}
          ticker={props.result.ticker}
        />
        <StockCashFlowSummary
          cashFlow={props.cashFlow}
          ticker={props.result.ticker}
        />
      </div>
    </main>
  );
}
