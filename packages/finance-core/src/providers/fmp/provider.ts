import { failResult, okResult } from "../../errors";
import type { FinanceCoreResult, Period, ProvenanceRecord } from "../../types";

const DEFAULT_FMP_STABLE_BASE_URL = "https://financialmodelingprep.com/stable";

type FetchFn = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>;

type FmpResponse<T> = {
  data: T;
  url: string;
  retrievedAt: string;
};

type FmpRecord = Record<string, string | number | boolean | null | undefined>;

type FmpRequestParams = {
  path: string;
  query?: Record<string, string | number | undefined>;
};

export type FmpStatementRecord = FmpRecord & { date?: string };
export type FmpRatioRecord = FmpRecord & { date?: string };
export type FmpEstimateRecord = FmpRecord & { date?: string };
export type FmpEarningsRecord = FmpRecord & { symbol?: string; date?: string };
export type FmpInsiderTradeRecord = FmpRecord & {
  symbol?: string;
  filingDate?: string;
};
export type FmpSegmentBreakdown = Record<string, number | null>;
export type FmpSegmentRecord = {
  date?: string;
  [key: string]:
    | string
    | number
    | boolean
    | null
    | FmpSegmentBreakdown
    | undefined;
};

export type FmpFundamentalsPayload = Record<
  string,
  {
    periodRequested: Period;
    periodResolved: "annual" | "quarterly";
    incomeStatements: FmpStatementRecord[];
    balanceSheets: FmpStatementRecord[];
    cashFlowStatements: FmpStatementRecord[];
  }
>;

export type FmpRatiosPayload = Record<
  string,
  {
    periodRequested: Period;
    periodResolved: Period;
    records: FmpRatioRecord[];
  }
>;

export type FmpEstimatesPayload = Record<string, FmpEstimateRecord[]>;
export type FmpEarningsPayload = Record<string, FmpEarningsRecord[]>;
export type FmpInsiderPayload = Record<string, FmpInsiderTradeRecord[]>;
export type FmpSegmentsPayload = Record<string, FmpSegmentRecord[]>;

export type FmpProvider = {
  fundamentals(input: {
    ticker: string;
    period: Period;
    limit: number;
  }): Promise<FinanceCoreResult<FmpFundamentalsPayload>>;
  ratios(input: {
    ticker: string;
    period: Period;
    limit: number;
  }): Promise<FinanceCoreResult<FmpRatiosPayload>>;
  estimates(input: {
    ticker: string;
    limit: number;
  }): Promise<FinanceCoreResult<FmpEstimatesPayload>>;
  earnings(input: {
    ticker: string;
  }): Promise<FinanceCoreResult<FmpEarningsPayload>>;
  insiderTrades(input: {
    ticker: string;
    limit: number;
  }): Promise<FinanceCoreResult<FmpInsiderPayload>>;
  segments(input: {
    ticker: string;
    period: "annual" | "quarterly";
    limit: number;
  }): Promise<FinanceCoreResult<FmpSegmentsPayload>>;
};

export function createFmpProvider(options: {
  apiKey?: string;
  fetchFn?: FetchFn;
  now?: () => Date;
}): FmpProvider {
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? (() => new Date());

  function normalizeTicker(ticker: string): string {
    return ticker.trim().toUpperCase();
  }

  function apiKey(): string {
    if (!options.apiKey) {
      throw new Error("Missing FMP_API_KEY credential.");
    }

    return options.apiKey;
  }

  function buildUrl(params: FmpRequestParams): string {
    const url = new URL(`${DEFAULT_FMP_STABLE_BASE_URL}${params.path}`);
    for (const [key, value] of Object.entries(params.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    url.searchParams.set("apikey", apiKey());
    return url.toString();
  }

  async function requestJson<T>(
    params: FmpRequestParams,
  ): Promise<FmpResponse<T>> {
    const url = buildUrl(params);
    const response = await fetchFn(url);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `HTTP ${response.status} for ${url}: ${body.slice(0, 300)}`,
      );
    }

    return {
      data: (await response.json()) as T,
      url,
      retrievedAt: now().toISOString(),
    };
  }

  async function withResult<T>(operation: () => Promise<FinanceCoreResult<T>>) {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failResult<T>(message);
    }
  }

  function firstDate(records: Array<{ date?: string }>): string | undefined {
    return typeof records[0]?.date === "string" ? records[0].date : undefined;
  }

  function firstFilingDate(
    records: Array<{ filingDate?: string }>,
  ): string | undefined {
    return typeof records[0]?.filingDate === "string"
      ? records[0].filingDate
      : undefined;
  }

  function provenance(params: {
    ticker: string;
    responses: Array<FmpResponse<unknown>>;
    asOfDate?: string;
  }): ProvenanceRecord[] {
    return params.responses.map((response) => ({
      provider: "fmp",
      ticker: params.ticker,
      url: response.url,
      retrievedAt: response.retrievedAt,
      asOfDate: params.asOfDate,
    }));
  }

  function resolveFmpPeriod(period: Period): "annual" | "quarter" {
    return period === "annual" ? "annual" : "quarter";
  }

  function isPlanLimitPeriodError(error: unknown): boolean {
    return (
      error instanceof Error &&
      error.message.includes("HTTP 402") &&
      error.message.includes("period")
    );
  }

  return {
    fundamentals(input) {
      return withResult(async () => {
        const ticker = normalizeTicker(input.ticker);
        const period = resolveFmpPeriod(input.period);
        const [income, balance, cashFlow] = await Promise.all([
          requestJson<FmpStatementRecord[]>({
            path: "/income-statement",
            query: { symbol: ticker, period, limit: input.limit },
          }),
          requestJson<FmpStatementRecord[]>({
            path: "/balance-sheet-statement",
            query: { symbol: ticker, period, limit: input.limit },
          }),
          requestJson<FmpStatementRecord[]>({
            path: "/cash-flow-statement",
            query: { symbol: ticker, period, limit: input.limit },
          }),
        ]);
        const asOfDate =
          firstDate(income.data) ??
          firstDate(balance.data) ??
          firstDate(cashFlow.data);

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
            provenance: provenance({
              ticker,
              responses: [income, balance, cashFlow],
              asOfDate,
            }),
          },
        );
      });
    },

    ratios(input) {
      return withResult(async () => {
        const ticker = normalizeTicker(input.ticker);
        const requestedPeriod = input.period;
        let response: FmpResponse<FmpRatioRecord[]>;
        let periodResolved: Period = requestedPeriod;
        let message: string | undefined;

        if (requestedPeriod === "ttm") {
          response = await requestJson<FmpRatioRecord[]>({
            path: "/ratios-ttm",
            query: { symbol: ticker },
          });
        } else {
          try {
            response = await requestJson<FmpRatioRecord[]>({
              path: "/ratios",
              query: {
                symbol: ticker,
                period: requestedPeriod === "quarterly" ? "quarter" : "annual",
                limit: input.limit,
              },
            });
          } catch (error) {
            if (
              requestedPeriod === "quarterly" &&
              isPlanLimitPeriodError(error)
            ) {
              response = await requestJson<FmpRatioRecord[]>({
                path: "/ratios",
                query: { symbol: ticker, period: "annual", limit: input.limit },
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
            provenance: provenance({
              ticker,
              responses: [response],
              asOfDate: firstDate(response.data),
            }),
          },
        );
      });
    },

    estimates(input) {
      return withResult(async () => {
        const ticker = normalizeTicker(input.ticker);
        const response = await requestJson<FmpEstimateRecord[]>({
          path: "/analyst-estimates",
          query: { symbol: ticker, period: "annual", limit: input.limit },
        });

        return okResult(
          { [ticker]: response.data },
          {
            provenance: provenance({
              ticker,
              responses: [response],
              asOfDate: firstDate(response.data),
            }),
          },
        );
      });
    },

    earnings(input) {
      return withResult(async () => {
        const ticker = normalizeTicker(input.ticker);
        const response = await requestJson<FmpEarningsRecord[]>({
          path: "/earnings",
          query: { symbol: ticker },
        });
        const records = response.data.filter((record) => {
          if (typeof record.symbol !== "string") {
            return true;
          }

          return record.symbol.toUpperCase() === ticker;
        });

        return okResult(
          { [ticker]: records },
          {
            provenance: provenance({
              ticker,
              responses: [response],
              asOfDate: firstDate(records),
            }),
          },
        );
      });
    },

    insiderTrades(input) {
      return withResult(async () => {
        const ticker = normalizeTicker(input.ticker);
        const cappedLimit = Math.max(1, Math.min(input.limit, 100));
        const response = await requestJson<FmpInsiderTradeRecord[]>({
          path: "/insider-trading/latest",
          query: { limit: cappedLimit },
        });
        const records = response.data
          .filter((record) => typeof record.symbol === "string")
          .filter((record) => record.symbol?.toUpperCase() === ticker)
          .slice(0, input.limit);

        return okResult(
          { [ticker]: records },
          {
            message:
              records.length === 0
                ? "No matching insider trades were found in the latest FMP feed for this ticker."
                : undefined,
            provenance: provenance({
              ticker,
              responses: [response],
              asOfDate: firstFilingDate(records),
            }),
          },
        );
      });
    },

    segments(input) {
      return withResult(async () => {
        const ticker = normalizeTicker(input.ticker);
        let response: FmpResponse<FmpSegmentRecord[]>;
        let message: string | undefined;

        try {
          response = await requestJson<FmpSegmentRecord[]>({
            path: "/revenue-product-segmentation",
            query: {
              symbol: ticker,
              period: input.period === "quarterly" ? "quarter" : "annual",
              structure: "flat",
            },
          });
        } catch (error) {
          if (input.period === "quarterly" && isPlanLimitPeriodError(error)) {
            response = await requestJson<FmpSegmentRecord[]>({
              path: "/revenue-product-segmentation",
              query: { symbol: ticker, period: "annual", structure: "flat" },
            });
            message =
              "Quarterly FMP segment data is not available for this API plan; returned annual segments instead.";
          } else {
            throw error;
          }
        }

        const records = response.data.slice(0, input.limit);

        return okResult(
          { [ticker]: records },
          {
            message,
            provenance: provenance({
              ticker,
              responses: [response],
              asOfDate: firstDate(records),
            }),
          },
        );
      });
    },
  };
}
