import type { FinanceCoreResult, ProvenanceRecord } from "@repo/finance-core";
import { fetchFmpEarnings, fetchFmpRatios } from "@repo/finance-core";
import { readFmpApiKey } from "@/lib/server/fmp";
import { validateTickerInput } from "@/lib/stocks";

const FUNDAMENTALS_PROVIDER = "fmp";

type FundamentalsMetricStatus = "available" | "unavailable" | "error";

type FundamentalsMetricBase = {
  label: string;
  provider: typeof FUNDAMENTALS_PROVIDER;
  endpoint: "earnings" | "ratios-ttm";
  status: FundamentalsMetricStatus;
  retrievedAt?: string;
  asOfDate?: string;
  provenance?: ProvenanceRecord[];
  message?: string;
};

export type EarningsMetric = FundamentalsMetricBase & {
  label: "Next earnings date";
  endpoint: "earnings";
  value?: string;
};

export type ValuationMetric = FundamentalsMetricBase & {
  label: "P/E ratio";
  endpoint: "ratios-ttm";
  value?: number;
};

export type FundamentalsSummarySection = {
  status: "success" | "partial" | "empty" | "error";
  message: string;
  earnings: EarningsMetric;
  valuation: ValuationMetric;
};

type EarningsPayload = Record<
  string,
  Array<Record<string, string | number | boolean | null | undefined>>
>;

type RatiosPayload = Record<
  string,
  {
    periodRequested: "annual" | "quarterly" | "ttm";
    periodResolved: "annual" | "quarterly" | "ttm";
    records: Array<Record<string, string | number | boolean | null | undefined>>;
  }
>;

function createEarningsMetric(
  overrides?: Partial<EarningsMetric>,
): EarningsMetric {
  return {
    label: "Next earnings date",
    provider: FUNDAMENTALS_PROVIDER,
    endpoint: "earnings",
    status: "unavailable",
    ...overrides,
  };
}

function createValuationMetric(
  overrides?: Partial<ValuationMetric>,
): ValuationMetric {
  return {
    label: "P/E ratio",
    provider: FUNDAMENTALS_PROVIDER,
    endpoint: "ratios-ttm",
    status: "unavailable",
    ...overrides,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readRetrievedAt(provenance?: ProvenanceRecord[]): string | undefined {
  return provenance?.[0]?.retrievedAt;
}

function readAsOfDate(provenance?: ProvenanceRecord[]): string | undefined {
  return provenance?.[0]?.asOfDate;
}

function summarizeMetricGap(metrics: Array<EarningsMetric | ValuationMetric>): string {
  const unavailableLabels = metrics
    .filter((metric) => metric.status !== "available")
    .map((metric) => metric.label.toLowerCase());

  return unavailableLabels.join(" and ");
}

function pickNextEarningsDate(
  records: Array<Record<string, string | number | boolean | null | undefined>>,
  now: Date,
): string | undefined {
  const upcoming = records
    .map((record) => record.date)
    .filter((value): value is string => typeof value === "string")
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .filter((value) => value.getTime() >= now.getTime())
    .sort((left, right) => left.getTime() - right.getTime());

  return upcoming[0]?.toISOString();
}

function extractPeRatio(
  record?: Record<string, string | number | boolean | null | undefined>,
): number | undefined {
  const candidates = [
    record?.priceToEarningsRatioTTM,
    record?.peRatioTTM,
    record?.priceEarningsRatioTTM,
    record?.peRatio,
  ];

  for (const candidate of candidates) {
    if (isFiniteNumber(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export function buildFundamentalsSummary(input: {
  ticker: string;
  earningsResult?: FinanceCoreResult<EarningsPayload>;
  ratiosResult?: FinanceCoreResult<RatiosPayload>;
  now?: Date;
}): FundamentalsSummarySection {
  const now = input.now ?? new Date();
  const earningsData = input.earningsResult?.data?.[input.ticker] ?? [];
  const ratioRecords = input.ratiosResult?.data?.[input.ticker]?.records ?? [];

  const nextEarningsDate = pickNextEarningsDate(earningsData, now);
  const peRatio = extractPeRatio(ratioRecords[0]);

  const earnings =
    input.earningsResult?.error
      ? createEarningsMetric({
            status: "error",
            message:
              input.earningsResult.message ??
            `Earnings data is temporarily unavailable for ${input.ticker}.`,
          provenance: input.earningsResult.provenance,
          retrievedAt: readRetrievedAt(input.earningsResult.provenance),
          asOfDate: readAsOfDate(input.earningsResult.provenance),
        })
      : nextEarningsDate
        ? createEarningsMetric({
            status: "available",
            value: nextEarningsDate,
            provenance: input.earningsResult?.provenance,
            retrievedAt: readRetrievedAt(input.earningsResult?.provenance),
            asOfDate: readAsOfDate(input.earningsResult?.provenance),
          })
        : createEarningsMetric({
            status: "unavailable",
            message: `No upcoming earnings date is available for ${input.ticker}.`,
            provenance: input.earningsResult?.provenance,
            retrievedAt: readRetrievedAt(input.earningsResult?.provenance),
            asOfDate: readAsOfDate(input.earningsResult?.provenance),
          });

  const valuation =
    input.ratiosResult?.error
      ? createValuationMetric({
          status: "error",
          message:
            input.ratiosResult.message ??
            `Valuation data is temporarily unavailable for ${input.ticker}.`,
          provenance: input.ratiosResult.provenance,
          retrievedAt: readRetrievedAt(input.ratiosResult.provenance),
          asOfDate: readAsOfDate(input.ratiosResult.provenance),
        })
      : isFiniteNumber(peRatio)
        ? createValuationMetric({
            status: "available",
            value: peRatio,
            provenance: input.ratiosResult?.provenance,
            retrievedAt: readRetrievedAt(input.ratiosResult?.provenance),
            asOfDate: readAsOfDate(input.ratiosResult?.provenance),
          })
        : createValuationMetric({
            status: "unavailable",
            message: `No trailing P/E ratio is available for ${input.ticker}.`,
            provenance: input.ratiosResult?.provenance,
            retrievedAt: readRetrievedAt(input.ratiosResult?.provenance),
            asOfDate: readAsOfDate(input.ratiosResult?.provenance),
          });

  const metrics = [earnings, valuation];
  const availableCount = metrics.filter((metric) => metric.status === "available").length;
  const errorCount = metrics.filter((metric) => metric.status === "error").length;

  if (availableCount === metrics.length) {
    return {
      status: "success",
      message: "Fundamentals loaded successfully from FMP.",
      earnings,
      valuation,
    };
  }

  if (availableCount > 0) {
    return {
      status: "partial",
      message: `${summarizeMetricGap(metrics)} ${availableCount === 1 ? "is" : "are"} unavailable or degraded for ${input.ticker}.`,
      earnings,
      valuation,
    };
  }

  if (errorCount === metrics.length) {
    return {
      status: "error",
      message: "Fundamentals are unavailable because both provider requests failed.",
      earnings,
      valuation,
    };
  }

  return {
    status: "empty",
    message: `No fundamentals fields are currently available for ${input.ticker}.`,
    earnings,
    valuation,
  };
}

export async function getFundamentalsSummary(
  ticker: string,
): Promise<FundamentalsSummarySection> {
  const validation = validateTickerInput(ticker);

  if (!validation.valid) {
    return {
      status: "empty",
      message: validation.message,
      earnings: createEarningsMetric({
        message: "Next earnings date is unavailable for this ticker.",
      }),
      valuation: createValuationMetric({
        message: "Valuation data is unavailable for this ticker.",
      }),
    };
  }

  const apiKey = readFmpApiKey();

  if (!apiKey) {
    return {
      status: "error",
      message: "Fundamentals are unavailable because the FMP API key is missing.",
      earnings: createEarningsMetric({
        status: "error",
        message: "Next earnings date is unavailable because the FMP API key is missing.",
      }),
      valuation: createValuationMetric({
        status: "error",
        message: "P/E ratio is unavailable because the FMP API key is missing.",
      }),
    };
  }

  const [earningsFetch, ratiosFetch] = await Promise.allSettled([
    fetchFmpEarnings({ ticker, apiKey }),
    fetchFmpRatios({ ticker, period: "ttm", limit: 1, apiKey }),
  ]);

  const earningsResult =
    earningsFetch.status === "fulfilled"
      ? earningsFetch.value
      : {
          data: null,
          error: true,
          message:
            earningsFetch.reason instanceof Error
              ? earningsFetch.reason.message
              : String(earningsFetch.reason),
        };

  const ratiosResult =
    ratiosFetch.status === "fulfilled"
      ? ratiosFetch.value
      : {
          data: null,
          error: true,
          message:
            ratiosFetch.reason instanceof Error
              ? ratiosFetch.reason.message
              : String(ratiosFetch.reason),
        };

  return buildFundamentalsSummary({
    ticker,
    earningsResult,
    ratiosResult,
  });
}
