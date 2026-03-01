import { failResult, okResult } from "../../errors";
import type { FinanceCoreResult } from "../../types";
import { requestFmpJson } from "./client";

type FmpSegmentsInput = {
  ticker: string;
  period: "annual" | "quarterly";
  limit: number;
  apiKey?: string;
};

type SegmentBreakdown = Record<string, number | null>;

type FmpSegmentRecord = {
  date?: string;
  [key: string]:
    | string
    | number
    | boolean
    | null
    | SegmentBreakdown
    | undefined;
};

type FmpSegmentsPayload = Record<string, FmpSegmentRecord[]>;

function extractAsOfDate(value: FmpSegmentRecord[]): string | undefined {
  if (value.length === 0) {
    return undefined;
  }

  const first = value[0];
  return typeof first?.date === "string" ? first.date : undefined;
}

export async function fetchFmpSegments(
  input: FmpSegmentsInput,
): Promise<FinanceCoreResult<FmpSegmentsPayload>> {
  const ticker = input.ticker.toUpperCase();

  try {
    let response: Awaited<
      ReturnType<typeof requestFmpJson<FmpSegmentRecord[]>>
    >;
    let message: string | undefined;

    try {
      response = await requestFmpJson<FmpSegmentRecord[]>({
        path: "/revenue-product-segmentation",
        query: {
          symbol: ticker,
          period: input.period === "quarterly" ? "quarter" : "annual",
          structure: "flat",
        },
        apiKey: input.apiKey,
      });
    } catch (error) {
      if (
        input.period === "quarterly" &&
        error instanceof Error &&
        error.message.includes("HTTP 402") &&
        error.message.includes("period")
      ) {
        response = await requestFmpJson<FmpSegmentRecord[]>({
          path: "/revenue-product-segmentation",
          query: {
            symbol: ticker,
            period: "annual",
            structure: "flat",
          },
          apiKey: input.apiKey,
        });
        message =
          "Quarterly FMP segment data is not available for this API plan; returned annual segments instead.";
      } else {
        throw error;
      }
    }

    const records = response.data.slice(0, input.limit);

    return okResult(
      {
        [ticker]: records,
      },
      {
        message,
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
