import { failResult, okResult } from "../../errors";
import type { FinanceCoreResult, ProvenanceRecord } from "../../types";
import { requestFmpJson } from "./client";

type FmpFundamentalsInput = {
  ticker: string;
  period: "annual" | "quarterly" | "ttm";
  limit: number;
  apiKey?: string;
};

type FmpStatementRecord = {
  date?: string;
  [key: string]: string | number | boolean | null | undefined;
};

type FmpFundamentalsPayload = Record<
  string,
  {
    periodRequested: "annual" | "quarterly" | "ttm";
    periodResolved: "annual" | "quarterly";
    incomeStatements: FmpStatementRecord[];
    balanceSheets: FmpStatementRecord[];
    cashFlowStatements: FmpStatementRecord[];
  }
>;

function resolveFmpPeriod(
  period: "annual" | "quarterly" | "ttm",
): "annual" | "quarter" {
  if (period === "quarterly" || period === "ttm") {
    return "quarter";
  }

  return "annual";
}

function makeProvenance(params: {
  ticker: string;
  asOfDate?: string;
  retrievedAt: string;
  urls: string[];
}): ProvenanceRecord[] {
  return params.urls.map((url) => ({
    provider: "fmp",
    ticker: params.ticker,
    url,
    asOfDate: params.asOfDate,
    retrievedAt: params.retrievedAt,
  }));
}

function readAsOfDate(records: FmpStatementRecord[]): string | undefined {
  if (records.length === 0) {
    return undefined;
  }

  const first = records[0];
  return typeof first?.date === "string" ? first.date : undefined;
}

export async function fetchFmpFundamentals(
  input: FmpFundamentalsInput,
): Promise<FinanceCoreResult<FmpFundamentalsPayload>> {
  const ticker = input.ticker.toUpperCase();
  const period = resolveFmpPeriod(input.period);

  try {
    const [income, balance, cashFlow] = await Promise.all([
      requestFmpJson<FmpStatementRecord[]>({
        path: "/income-statement",
        query: { symbol: ticker, period, limit: input.limit },
        apiKey: input.apiKey,
      }),
      requestFmpJson<FmpStatementRecord[]>({
        path: "/balance-sheet-statement",
        query: { symbol: ticker, period, limit: input.limit },
        apiKey: input.apiKey,
      }),
      requestFmpJson<FmpStatementRecord[]>({
        path: "/cash-flow-statement",
        query: { symbol: ticker, period, limit: input.limit },
        apiKey: input.apiKey,
      }),
    ]);

    const asOfDate =
      readAsOfDate(income.data) ??
      readAsOfDate(balance.data) ??
      readAsOfDate(cashFlow.data);

    return okResult(
      {
        [ticker]: {
          periodRequested: input.period,
          periodResolved: period === "quarter" ? "quarterly" : "annual",
          incomeStatements: income.data,
          balanceSheets: balance.data,
          cashFlowStatements: cashFlow.data,
        },
      },
      {
        provenance: makeProvenance({
          ticker,
          asOfDate,
          retrievedAt: income.retrievedAt,
          urls: [income.url, balance.url, cashFlow.url],
        }),
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failResult(message);
  }
}
