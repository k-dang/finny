import { failResult, okResult } from "../../errors";
import type { FinanceCoreResult } from "../../types";
import { requestFmpJson } from "./client";

type FmpEarningsCalendarInput = {
  ticker: string;
  apiKey?: string;
};

type FmpEarningsCalendarRecord = {
  date?: string;
  [key: string]: string | number | boolean | null | undefined;
};

type FmpEarningsCalendarPayload = Record<string, FmpEarningsCalendarRecord[]>;

function extractAsOfDate(value: FmpEarningsCalendarRecord[]): string | undefined {
  if (value.length === 0) {
    return undefined;
  }

  const first = value[0];
  return typeof first?.date === "string" ? first.date : undefined;
}

export async function fetchFmpEarningsCalendar(
  input: FmpEarningsCalendarInput,
): Promise<FinanceCoreResult<FmpEarningsCalendarPayload>> {
  const ticker = input.ticker.toUpperCase();

  try {
    const response = await requestFmpJson<FmpEarningsCalendarRecord[]>({
      path: "/earnings-calendar",
      query: { symbol: ticker },
      apiKey: input.apiKey,
    });

    return okResult(
      {
        [ticker]: response.data,
      },
      {
        provenance: [
          {
            provider: "fmp",
            ticker,
            url: response.url,
            retrievedAt: response.retrievedAt,
            asOfDate: extractAsOfDate(response.data),
          },
        ],
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failResult(message);
  }
}
