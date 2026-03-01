import { failResult, okResult } from "../../errors";
import type { FinanceCoreResult } from "../../types";
import { requestFmpJson } from "./client";

type FmpInsiderInput = {
  ticker: string;
  limit: number;
  apiKey?: string;
};

type FmpInsiderTradeRecord = {
  symbol?: string;
  filingDate?: string;
  [key: string]: string | number | boolean | null | undefined;
};

type FmpInsiderPayload = Record<string, FmpInsiderTradeRecord[]>;

function extractAsOfDate(value: FmpInsiderTradeRecord[]): string | undefined {
  if (value.length === 0) {
    return undefined;
  }

  const first = value[0];
  return typeof first?.filingDate === "string" ? first.filingDate : undefined;
}

export async function fetchFmpInsiderTrades(
  input: FmpInsiderInput,
): Promise<FinanceCoreResult<FmpInsiderPayload>> {
  const ticker = input.ticker.toUpperCase();
  const cappedLimit = Math.max(1, Math.min(input.limit, 100));

  try {
    const response = await requestFmpJson<FmpInsiderTradeRecord[]>({
      path: "/insider-trading/latest",
      query: {
        limit: cappedLimit,
      },
      apiKey: input.apiKey,
    });

    const records = response.data
      .filter((record) => typeof record.symbol === "string")
      .filter((record) => record.symbol?.toUpperCase() === ticker)
      .slice(0, input.limit);

    return okResult(
      {
        [ticker]: records,
      },
      {
        message:
          records.length === 0
            ? "No matching insider trades were found in the latest FMP feed for this ticker."
            : undefined,
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
