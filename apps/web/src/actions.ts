"use server";

import { redirect } from "next/navigation";
import { resolveTickerInput } from "@/lib/stocks";

export async function openTickerDashboard(formData: FormData) {
  const rawTicker = formData.get("ticker");
  const submittedTicker = typeof rawTicker === "string" ? rawTicker : "";
  const resolution = await resolveTickerInput(submittedTicker);

  if (resolution.status === "ready" || resolution.status === "unverified") {
    redirect(`/stocks/${encodeURIComponent(resolution.ticker)}`);
  }

  const params = new URLSearchParams();

  if (submittedTicker) {
    params.set("ticker", submittedTicker);
  }

  if (resolution.message) {
    params.set("error", resolution.message);
  }

  redirect(`/?${params.toString()}`);
}
