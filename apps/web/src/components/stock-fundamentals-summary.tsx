import type {
  EarningsMetric,
  FundamentalsSummarySection,
  ValuationMetric,
} from "@/lib/fundamentals-summary";
import { cn } from "@/lib/utils";

type StockFundamentalsSummaryProps = {
  ticker: string;
  fundamentals: FundamentalsSummarySection;
};

const ratioFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
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

function statusTone(status: FundamentalsSummarySection["status"]): string {
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

function renderValue(metric: EarningsMetric | ValuationMetric): string {
  if (metric.label === "P/E ratio") {
    return typeof metric.value === "number"
      ? ratioFormatter.format(metric.value)
      : "Unavailable";
  }

  return typeof metric.value === "string" ? formatDate(metric.value) : "Unavailable";
}

function MetricCard(props: { metric: EarningsMetric | ValuationMetric }) {
  return (
    <article className="rounded-[1.25rem] border border-slate-900/10 bg-slate-50 p-4">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
        {props.metric.label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
        {renderValue(props.metric)}
      </p>
      <div className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
        <p>
          Source: {props.metric.provider.toUpperCase()} {props.metric.endpoint}
        </p>
        <p>Retrieved: {formatTimestamp(props.metric.retrievedAt)}</p>
        <p>As of: {formatDate(props.metric.asOfDate)}</p>
      </div>
      {props.metric.status !== "available" && props.metric.message ? (
        <p className="mt-3 text-sm leading-6 text-slate-700">{props.metric.message}</p>
      ) : null}
    </article>
  );
}

export function StockFundamentalsSummary(
  props: StockFundamentalsSummaryProps,
) {
  return (
    <section className="rounded-[1.75rem] border border-slate-900/10 bg-white/80 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
            Earnings & valuation
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
            Upcoming catalyst and trailing valuation for {props.ticker}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            Fundamentals are normalized behind the dashboard layer so the UI can
            preserve source freshness and render partial results cleanly.
          </p>
        </div>
        <div className="rounded-full border border-slate-900/10 bg-slate-950 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-100">
          {props.fundamentals.status}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <MetricCard metric={props.fundamentals.earnings} />
        <MetricCard metric={props.fundamentals.valuation} />
      </div>

      <div className={cn("mt-4 rounded-[1.25rem] px-4 py-3 text-sm leading-6", statusTone(props.fundamentals.status))}>
        {props.fundamentals.message}
      </div>
    </section>
  );
}
