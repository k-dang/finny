import Link from "next/link";
import { ArrowRight, Building2, Search, ShieldCheck } from "lucide-react";
import { openTickerDashboard } from "@/actions";
import { TickerSearchForm } from "@/components/ticker-search-form";
import { normalizeTickerInput } from "@/lib/stocks";

function readTickerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function Home(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const submittedTicker = normalizeTickerInput(readTickerValue(searchParams.ticker));
  const errorMessage = readTickerValue(searchParams.error) || undefined;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.18),_transparent_32%),linear-gradient(180deg,_#f5f1e8_0%,_#fffdf8_45%,_#f3efe4_100%)] px-6 py-10 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-between gap-12">
        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-900/15 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-teal-900 shadow-sm backdrop-blur">
              <ShieldCheck className="size-3.5" />
              U.S.-listed equities only
            </div>
            <div className="space-y-4">
              <p className="font-mono text-sm uppercase tracking-[0.28em] text-teal-800/80">
                Finny Phase 1
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
                Open a stock dashboard with a ticker, not a terminal.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-700">
                Search a single symbol, land on a stable stock URL, and confirm
                the company before deeper quote and fundamentals slices arrive in
                later phases.
              </p>
            </div>
            <TickerSearchForm
              action={openTickerDashboard}
              defaultValue={submittedTicker}
              errorMessage={errorMessage}
            />
            <div className="flex flex-wrap gap-3 text-sm text-slate-700">
              <span className="font-medium text-slate-900">Try:</span>
              {["AAPL", "MSFT", "BRK.B", "NVDA"].map((ticker) => (
                <Link
                  key={ticker}
                  className="rounded-full border border-slate-300 bg-white/75 px-3 py-1 transition hover:border-teal-700 hover:text-teal-900"
                  href={`/?ticker=${encodeURIComponent(ticker)}`}
                >
                  {ticker}
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-[2rem] border border-slate-900/10 bg-slate-950 px-6 py-6 text-slate-100 shadow-2xl shadow-slate-900/10">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-teal-300">
                  Canonical Flow
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Search to stable route
                </p>
              </div>
              <Building2 className="size-5 text-teal-300" />
            </div>
            <div className="space-y-4 pt-5">
              {[
                "Normalize ticker input to uppercase symbols.",
                "Reject invalid or unsupported symbols with a clear state.",
                "Route every valid symbol to a bookmarkable /stocks/[ticker] page.",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-4"
                >
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-teal-300" />
                  <p className="text-sm leading-6 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Ticker Search",
              body: "Lookup starts from the public home page with no auth wall.",
              icon: Search,
            },
            {
              title: "Canonical URLs",
              body: "Valid symbols resolve to a shareable stock page that keeps the route stable.",
              icon: ArrowRight,
            },
            {
              title: "Coverage Guardrail",
              body: "V1 is intentionally limited to active U.S.-listed equities.",
              icon: ShieldCheck,
            },
          ].map(({ title, body, icon: Icon }) => (
            <div
              key={title}
              className="rounded-[1.5rem] border border-slate-900/10 bg-white/70 p-5 shadow-sm backdrop-blur"
            >
              <div className="mb-4 inline-flex rounded-full bg-teal-900/8 p-2 text-teal-900">
                <Icon className="size-4" />
              </div>
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
