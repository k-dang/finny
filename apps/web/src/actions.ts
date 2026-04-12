"use server";

import { redirect } from "next/navigation";
import { resolveTickerInput } from "@/lib/stocks";

export type OpenTickerDashboardState = {
  errorMessage?: string;
};

export async function openTickerDashboard(
  _previousState: OpenTickerDashboardState,
  formData: FormData,
): Promise<OpenTickerDashboardState> {
  const rawTicker = formData.get("ticker");
  const submittedTicker = typeof rawTicker === "string" ? rawTicker : "";
  const resolution = await resolveTickerInput(submittedTicker);

  if (resolution.status === "ready" || resolution.status === "unverified") {
    redirect(`/stocks/${encodeURIComponent(resolution.ticker)}`);
  }

  return {
    errorMessage:
      resolution.message ?? "Ticker lookup failed. Try a different symbol.",
  };
}
