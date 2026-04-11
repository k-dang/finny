import { BadgeAlert, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StockLookupResult } from "@/lib/stocks";

type StockStatusBannerProps = {
  result: StockLookupResult;
};

export function StockStatusBanner(props: StockStatusBannerProps) {
  if (props.result.status === "ready") {
    return (
      <div className="rounded-[1.5rem] border border-emerald-900/10 bg-emerald-50 px-5 py-4 text-emerald-950">
        <div className="flex items-start gap-3">
          <BadgeCheck className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Coverage confirmed</p>
            <p className="mt-1 text-sm leading-6 text-emerald-900/80">
              Verified as an active U.S. equity through Alpaca
              {props.result.exchange ? ` on ${props.result.exchange}.` : "."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tone =
    props.result.status === "unverified"
      ? "border-amber-900/15 bg-amber-50 text-amber-950"
      : "border-rose-900/10 bg-rose-50 text-rose-950";

  const copy =
    props.result.status === "unverified"
      ? props.result.message
      : `${props.result.message} Search another symbol or return home.`;

  const title =
    props.result.status === "unverified"
      ? "Coverage check unavailable"
      : props.result.status === "invalid"
        ? "Invalid ticker"
        : "Ticker not supported";

  return (
    <div className={cn("rounded-[1.5rem] px-5 py-4", tone)}>
      <div className="flex items-start gap-3">
        <BadgeAlert className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6">{copy}</p>
        </div>
      </div>
    </div>
  );
}
