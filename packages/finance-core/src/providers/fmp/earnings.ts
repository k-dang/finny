import { failResult, okResult } from "../../errors";
import type { FinanceCoreResult } from "../../types";
import { requestFmpJson } from "./client";

type FmpEarningsCalendarInput = {
  ticker: string;
  apiKey?: string;
};

type FmpEarningsRecord = {
  symbol?: string;
  date?: string;
  [key: string]: string | number | boolean | null | undefined;
};

type FmpEarningsPayload = Record<string, FmpEarningsRecord[]>;

function extractAsOfDate(value: FmpEarningsRecord[]): string | undefined {
  if (value.length === 0) {
    return undefined;
  }

  const first = value[0];
  return typeof first?.date === "string" ? first.date : undefined;
}

function filterTickerRecords(
  ticker: string,
  records: FmpEarningsRecord[],
): FmpEarningsRecord[] {
  return records.filter((record) => {
    if (typeof record.symbol !== "string") {
      return true;
    }

    return record.symbol.toUpperCase() === ticker;
  });
}

export async function fetchFmpEarnings(
  input: FmpEarningsCalendarInput,
): Promise<FinanceCoreResult<FmpEarningsPayload>> {
  const ticker = input.ticker.toUpperCase();

  try {
    const response = await requestFmpJson<FmpEarningsRecord[]>({
      path: "/earnings",
      query: { symbol: ticker },
      apiKey: input.apiKey,
    });
    const records = filterTickerRecords(ticker, response.data);

    return okResult(
      {
        [ticker]: records,
      },
      {
        provenance: [
          {
            provider: "fmp",
            ticker,
            url: response.url,
            retrievedAt: response.retrievedAt,
            asOfDate: extractAsOfDate(records),
          },
        ],
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failResult(message);
  }
}
