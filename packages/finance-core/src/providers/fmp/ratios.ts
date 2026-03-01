import { failResult, okResult } from "../../errors";
import type { FinanceCoreResult } from "../../types";
import { requestFmpJson } from "./client";

type FmpRatiosInput = {
  ticker: string;
  period: "annual" | "quarterly" | "ttm";
  limit: number;
  apiKey?: string;
};

type FmpRatioRecord = {
  date?: string;
  [key: string]: string | number | boolean | null | undefined;
};

type FmpRatiosPayload = Record<
  string,
  {
    periodRequested: "annual" | "quarterly" | "ttm";
    periodResolved: "annual" | "quarterly" | "ttm";
    records: FmpRatioRecord[];
  }
>;

function extractAsOfDate(value: FmpRatioRecord[]): string | undefined {
  if (value.length > 0) {
    const first = value[0];
    if (typeof first?.date === "string") {
      return first.date;
    }
  }

  return undefined;
}

export async function fetchFmpRatios(
  input: FmpRatiosInput,
): Promise<FinanceCoreResult<FmpRatiosPayload>> {
  const ticker = input.ticker.toUpperCase();
  const requestedPeriod = input.period;

  try {
    let response: Awaited<ReturnType<typeof requestFmpJson<FmpRatioRecord[]>>>;
    let periodResolved: "annual" | "quarterly" | "ttm" = requestedPeriod;
    let message: string | undefined;

    if (requestedPeriod === "ttm") {
      response = await requestFmpJson<FmpRatioRecord[]>({
        path: "/ratios-ttm",
        query: { symbol: ticker },
        apiKey: input.apiKey,
      });
    } else {
      try {
        response = await requestFmpJson<FmpRatioRecord[]>({
          path: "/ratios",
          query: {
            symbol: ticker,
            period: requestedPeriod === "quarterly" ? "quarter" : "annual",
            limit: input.limit,
          },
          apiKey: input.apiKey,
        });
      } catch (error) {
        if (
          requestedPeriod === "quarterly" &&
          error instanceof Error &&
          error.message.includes("HTTP 402") &&
          error.message.includes("period")
        ) {
          response = await requestFmpJson<FmpRatioRecord[]>({
            path: "/ratios",
            query: {
              symbol: ticker,
              period: "annual",
              limit: input.limit,
            },
            apiKey: input.apiKey,
          });
          periodResolved = "annual";
          message =
            "Quarterly FMP ratios are not available for this API plan; returned annual ratios instead.";
        } else {
          throw error;
        }
      }
    }

    return okResult(
      {
        [ticker]: {
          periodRequested: requestedPeriod,
          periodResolved,
          records: response.data,
        },
      },
      {
        message,
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
