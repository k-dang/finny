import type { CashFlowSummarySection } from "@/lib/cash-flow-summary";
import { cn } from "@/lib/utils";

type StockCashFlowSummaryProps = {
  ticker: string;
  cashFlow: CashFlowSummarySection;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

function formatTimestamp(value?: string): string {
  if (!value) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value?: string): string {
  if (!value) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function valueTone(value?: number): string {
  if (typeof value !== "number") {
    return "text-slate-950";
  }

  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-rose-700";
  }

  return "text-slate-950";
}

function formatCashValue(value?: number): string {
  if (typeof value !== "number") {
    return "Unavailable";
  }

  return currencyFormatter.format(value);
}

function statusTone(status: CashFlowSummarySection["status"]): string {
  if (status === "error") {
    return "border border-rose-900/10 bg-rose-50 text-rose-900";
  }

  if (status === "partial") {
    return "border border-amber-900/15 bg-amber-50 text-amber-900";
  }

  if (status === "empty") {
    return "border border-slate-900/10 bg-slate-50 text-slate-700";
  }

  return "border border-emerald-900/10 bg-emerald-50 text-emerald-900";
}

export function StockCashFlowSummary(props: StockCashFlowSummaryProps) {
  const freshnessMetric = props.cashFlow.metrics.find(
    (metric) => metric.retrievedAt || metric.asOfDate,
  );

  return (
    <section className="rounded-[1.75rem] border border-slate-900/10 bg-white/80 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
            Cash flow
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
            Latest normalized cash movement for {props.ticker}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            Compact annual cash-flow fields from FMP fundamentals. Zero values stay visible
            as real values, while unavailable fields are labeled explicitly.
          </p>
        </div>
        <div className="rounded-full border border-slate-900/10 bg-slate-950 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-100">
          {props.cashFlow.status}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {props.cashFlow.metrics.map((metric) => (
          <article
            key={metric.key}
            className="rounded-[1.25rem] border border-slate-900/10 bg-slate-50 p-4"
          >
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
              {metric.label}
            </p>
            <p
              className={cn(
                "mt-3 text-3xl font-semibold tracking-[-0.03em]",
                valueTone(metric.value),
              )}
            >
              {formatCashValue(metric.value)}
            </p>
            <div className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
              <p>
                Source: {metric.provider.toUpperCase()} {metric.endpoint}
              </p>
              <p>Retrieved: {formatTimestamp(metric.retrievedAt)}</p>
              <p>As of: {formatDate(metric.asOfDate)}</p>
            </div>
            {metric.status !== "available" && metric.message ? (
              <p className="mt-3 text-sm leading-6 text-slate-700">{metric.message}</p>
            ) : null}
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div
          className={cn(
            "rounded-[1.25rem] px-4 py-3 text-sm leading-6",
            statusTone(props.cashFlow.status),
          )}
        >
          {props.cashFlow.message}
        </div>
        <div className="rounded-[1.25rem] border border-slate-900/10 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
          <p>
            Period: {props.cashFlow.periodResolved ?? props.cashFlow.periodRequested}
          </p>
          <p>Retrieved: {formatTimestamp(freshnessMetric?.retrievedAt)}</p>
          <p>Statement date: {formatDate(freshnessMetric?.asOfDate)}</p>
        </div>
      </div>
    </section>
  );
}
