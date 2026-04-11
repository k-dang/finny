import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type TickerSearchFormProps = {
  defaultValue?: string;
  errorMessage?: string;
  compact?: boolean;
};

export function TickerSearchForm(props: TickerSearchFormProps) {
  return (
    <form
      action="/"
      className={cn(
        "rounded-[1.75rem] border border-slate-900/10 bg-white/80 p-4 shadow-xl shadow-slate-900/5 backdrop-blur",
        props.compact && "rounded-[1.25rem] p-3 shadow-sm",
      )}
      role="search"
    >
      <Label
        className="mb-3 block font-mono text-xs uppercase tracking-[0.22em] text-slate-600"
        htmlFor="ticker"
      >
        Search ticker
      </Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoCapitalize="characters"
            autoComplete="off"
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-base font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
            defaultValue={props.defaultValue}
            id="ticker"
            inputMode="text"
            maxLength={7}
            name="ticker"
            placeholder="AAPL or BRK.B"
            spellCheck={false}
          />
        </div>
        <Button
          className="h-12 rounded-2xl px-5 text-sm font-semibold"
          type="submit"
        >
          Open dashboard
        </Button>
      </div>
      <p
        className={cn(
          "mt-3 text-sm leading-6",
          props.errorMessage ? "text-rose-700" : "text-slate-600",
        )}
      >
        {props.errorMessage ??
          "Coverage is limited to active U.S.-listed equities in v1."}
      </p>
    </form>
  );
}
