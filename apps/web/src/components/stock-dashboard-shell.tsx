import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { StockQuoteSummary } from "@/components/stock-quote-summary";
import { StockStatusBanner } from "@/components/stock-status-banner";
import { TickerSearchForm } from "@/components/ticker-search-form";
import type { QuoteSummarySection } from "@/lib/quote-summary";
import type { StockLookupResult } from "@/lib/stocks";

type StockDashboardShellProps = {
  result: StockLookupResult;
  quote: QuoteSummarySection;
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
                  ? "The dashboard is now showing live quote context. Earnings, valuation, and cash-flow slices will land in the next phases."
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

        <section className="grid gap-4 md:grid-cols-2">
          {[
            {
              title: "Earnings & Valuation",
              body: "Phase 3 will add the next earnings date and a valuation read like P/E.",
            },
            {
              title: "Cash Flow",
              body: "Phase 4 will add a compact operating, investing, financing, and free-cash-flow view.",
            },
          ].map((section) => (
            <article
              key={section.title}
              className="rounded-[1.5rem] border border-slate-900/10 bg-white/75 p-5 shadow-sm backdrop-blur"
            >
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
                Planned slice
              </p>
              <h2 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-slate-950">
                {section.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {section.body}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
