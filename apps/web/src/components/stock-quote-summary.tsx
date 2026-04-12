import type { QuoteSummarySection } from "@/lib/quote-summary";
import { cn } from "@/lib/utils";

type StockQuoteSummaryProps = {
  ticker: string;
  quote: QuoteSummarySection;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  signDisplay: "always",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatSignedCurrency(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${currencyFormatter.format(Math.abs(value))}`;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
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

export function StockQuoteSummary(props: StockQuoteSummaryProps) {
  const dataQuote =
    props.quote.status === "success" || props.quote.status === "partial"
      ? props.quote
      : null;

  return (
    <section className="rounded-[1.75rem] border border-slate-900/10 bg-white/80 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
            Quote summary
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
            Live price context for {props.ticker}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            Source: {props.quote.source.provider.toUpperCase()} {props.quote.source.feed.toUpperCase()} feed.
            Daily movement uses the {props.quote.source.referencePoint.toLowerCase()}.
          </p>
        </div>
        <div className="rounded-full border border-slate-900/10 bg-slate-950 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-100">
          {props.quote.status}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <article className="rounded-[1.25rem] border border-slate-900/10 bg-slate-50 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
            Current price
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
            {dataQuote ? currencyFormatter.format(dataQuote.currentPrice) : "Unavailable"}
          </p>
        </article>

        <article className="rounded-[1.25rem] border border-slate-900/10 bg-slate-50 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
            Daily move
          </p>
          <p
            className={cn(
              "mt-3 text-3xl font-semibold tracking-[-0.03em]",
              dataQuote ? valueTone(dataQuote.priceChange) : "text-slate-950",
            )}
          >
            {dataQuote && typeof dataQuote.priceChange === "number"
              ? formatSignedCurrency(dataQuote.priceChange)
              : "Unavailable"}
          </p>
        </article>

        <article className="rounded-[1.25rem] border border-slate-900/10 bg-slate-50 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
            Daily change
          </p>
          <p
            className={cn(
              "mt-3 text-3xl font-semibold tracking-[-0.03em]",
              dataQuote ? valueTone(dataQuote.percentChange) : "text-slate-950",
            )}
          >
            {dataQuote && typeof dataQuote.percentChange === "number"
              ? percentFormatter.format(dataQuote.percentChange / 100)
              : "Unavailable"}
          </p>
        </article>

        <article className="rounded-[1.25rem] border border-slate-900/10 bg-slate-50 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">
            Last updated
          </p>
          <p className="mt-3 text-lg font-semibold tracking-[-0.02em] text-slate-950">
            {dataQuote ? formatTimestamp(dataQuote.updatedAt) : "Unavailable"}
          </p>
          {dataQuote?.exchange ? (
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              Exchange {dataQuote.exchange}
            </p>
          ) : null}
        </article>
      </div>

      <div
        className={cn(
          "mt-4 rounded-[1.25rem] px-4 py-3 text-sm leading-6",
          props.quote.status === "error"
            ? "border border-rose-900/10 bg-rose-50 text-rose-900"
            : props.quote.status === "partial"
              ? "border border-amber-900/15 bg-amber-50 text-amber-900"
              : props.quote.status === "empty"
                ? "border border-slate-900/10 bg-slate-50 text-slate-700"
                : "border border-emerald-900/10 bg-emerald-50 text-emerald-900",
        )}
      >
        {props.quote.status === "success"
          ? "Quote summary loaded successfully from Alpaca."
          : props.quote.message}
      </div>
    </section>
  );
}
