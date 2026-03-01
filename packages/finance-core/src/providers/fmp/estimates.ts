import { failResult, okResult } from "../../errors";
import type { FinanceCoreResult } from "../../types";
import { requestFmpJson } from "./client";

type FmpEstimatesInput = {
  ticker: string;
  limit: number;
  apiKey?: string;
};

type FmpEstimateRecord = {
  date?: string;
  [key: string]: string | number | boolean | null | undefined;
};

type FmpEstimatesPayload = Record<string, FmpEstimateRecord[]>;

function extractAsOfDate(value: FmpEstimateRecord[]): string | undefined {
  if (value.length === 0) {
    return undefined;
  }

  const first = value[0];
  return typeof first?.date === "string" ? first.date : undefined;
}

export async function fetchFmpEstimates(
  input: FmpEstimatesInput,
): Promise<FinanceCoreResult<FmpEstimatesPayload>> {
  const ticker = input.ticker.toUpperCase();

  try {
    const response = await requestFmpJson<FmpEstimateRecord[]>({
      path: "/analyst-estimates",
      query: {
        symbol: ticker,
        period: "annual",
        limit: input.limit,
      },
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
