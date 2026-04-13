import type { FinanceCoreResult, ProvenanceRecord } from "@repo/finance-core";
import { fetchFmpFundamentals } from "@repo/finance-core";
import { readFmpApiKey } from "@/lib/server/fmp";
import { validateTickerInput } from "@/lib/stocks";

const CASH_FLOW_PROVIDER = "fmp";
const CASH_FLOW_ENDPOINT = "cash-flow-statement";

type CashFlowMetricStatus = "available" | "unavailable" | "error";

type CashFlowMetricLabel =
  | "Operating cash flow"
  | "Investing cash flow"
  | "Financing cash flow"
  | "Free cash flow";

type CashFlowMetricKey =
  | "operatingCashFlow"
  | "investingCashFlow"
  | "financingCashFlow"
  | "freeCashFlow";

type CashFlowMetric = {
  key: CashFlowMetricKey;
  label: CashFlowMetricLabel;
  provider: typeof CASH_FLOW_PROVIDER;
  endpoint: typeof CASH_FLOW_ENDPOINT;
  status: CashFlowMetricStatus;
  value?: number;
  retrievedAt?: string;
  asOfDate?: string;
  provenance?: ProvenanceRecord[];
  message?: string;
};

export type CashFlowSummarySection = {
  status: "success" | "partial" | "empty" | "error";
  message: string;
  periodRequested: "annual" | "quarterly" | "ttm";
  periodResolved?: "annual" | "quarterly";
  metrics: CashFlowMetric[];
};

type FmpStatementRecord = Record<
  string,
  string | number | boolean | null | undefined
>;

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

const metricDefinitions: Array<{
  key: CashFlowMetricKey;
  label: CashFlowMetricLabel;
  candidates: string[];
}> = [
  {
    key: "operatingCashFlow",
    label: "Operating cash flow",
    candidates: [
      "netCashProvidedByOperatingActivities",
      "operatingCashFlow",
      "cashFlowFromOperations",
    ],
  },
  {
    key: "investingCashFlow",
    label: "Investing cash flow",
    candidates: [
      "netCashProvidedByInvestingActivities",
      "netCashUsedForInvestingActivites",
      "netCashUsedForInvestingActivities",
      "cashFlowFromInvestment",
      "investingCashFlow",
    ],
  },
  {
    key: "financingCashFlow",
    label: "Financing cash flow",
    candidates: [
      "netCashProvidedByFinancingActivities",
      "netCashUsedProvidedByFinancingActivities",
      "cashFlowFromFinancing",
      "financingCashFlow",
    ],
  },
  {
    key: "freeCashFlow",
    label: "Free cash flow",
    candidates: ["freeCashFlow"],
  },
];

function readRetrievedAt(provenance?: ProvenanceRecord[]): string | undefined {
  return provenance?.[0]?.retrievedAt;
}

function readAsOfDate(provenance?: ProvenanceRecord[]): string | undefined {
  return provenance?.[0]?.asOfDate;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function createMetric(
  input: Pick<CashFlowMetric, "key" | "label"> & Partial<CashFlowMetric>,
): CashFlowMetric {
  return {
    provider: CASH_FLOW_PROVIDER,
    endpoint: CASH_FLOW_ENDPOINT,
    status: "unavailable",
    ...input,
  };
}

function readMetricValue(
  record: FmpStatementRecord | undefined,
  candidates: string[],
): number | undefined {
  for (const candidate of candidates) {
    const value = record?.[candidate];

    if (isFiniteNumber(value)) {
      return value;
    }
  }

  return undefined;
}

function summarizeMetricGap(metrics: CashFlowMetric[]): string {
  return metrics
    .filter((metric) => metric.status !== "available")
    .map((metric) => metric.label.toLowerCase())
    .join(", ");
}

export function buildCashFlowSummary(input: {
  ticker: string;
  fundamentalsResult?: FinanceCoreResult<FmpFundamentalsPayload>;
  periodRequested?: "annual" | "quarterly" | "ttm";
}): CashFlowSummarySection {
  const payload = input.fundamentalsResult?.data?.[input.ticker];
  const provenance = input.fundamentalsResult?.provenance;
  const retrievedAt = readRetrievedAt(provenance);
  const asOfDate = readAsOfDate(provenance);
  const latestRecord = payload?.cashFlowStatements?.[0];
  const periodRequested = payload?.periodRequested ?? input.periodRequested ?? "annual";
  const periodResolved = payload?.periodResolved;

  const metrics = metricDefinitions.map((definition) => {
    if (input.fundamentalsResult?.error) {
      return createMetric({
        key: definition.key,
        label: definition.label,
        status: "error",
        message:
          input.fundamentalsResult.message ??
          `Cash-flow data is temporarily unavailable for ${input.ticker}.`,
        provenance,
        retrievedAt,
        asOfDate,
      });
    }

    const value = readMetricValue(latestRecord, definition.candidates);

    if (typeof value === "number") {
      return createMetric({
        key: definition.key,
        label: definition.label,
        status: "available",
        value,
        provenance,
        retrievedAt,
        asOfDate,
      });
    }

    return createMetric({
      key: definition.key,
      label: definition.label,
      status: "unavailable",
      message: `${definition.label} is unavailable for ${input.ticker}.`,
      provenance,
      retrievedAt,
      asOfDate,
    });
  });

  const availableCount = metrics.filter((metric) => metric.status === "available").length;
  const errorCount = metrics.filter((metric) => metric.status === "error").length;

  if (availableCount === metrics.length) {
    return {
      status: "success",
      message: "Cash-flow data loaded successfully from FMP fundamentals.",
      periodRequested,
      periodResolved,
      metrics,
    };
  }

  if (availableCount > 0) {
    return {
      status: "partial",
      message: `${summarizeMetricGap(metrics)} ${availableCount === 3 ? "is" : "are"} unavailable or degraded for ${input.ticker}.`,
      periodRequested,
      periodResolved,
      metrics,
    };
  }

  if (errorCount === metrics.length) {
    return {
      status: "error",
      message: "Cash-flow data is unavailable because the provider request failed.",
      periodRequested,
      periodResolved,
      metrics,
    };
  }

  return {
    status: "empty",
    message: `No cash-flow fields are currently available for ${input.ticker}.`,
    periodRequested,
    periodResolved,
    metrics,
  };
}

export async function getCashFlowSummary(
  ticker: string,
): Promise<CashFlowSummarySection> {
  const validation = validateTickerInput(ticker);

  if (!validation.valid) {
    return {
      status: "empty",
      message: validation.message,
      periodRequested: "annual",
      metrics: metricDefinitions.map((definition) =>
        createMetric({
          key: definition.key,
          label: definition.label,
          message: `${definition.label} is unavailable for this ticker.`,
        }),
      ),
    };
  }

  const apiKey = readFmpApiKey();

  if (!apiKey) {
    return {
      status: "error",
      message: "Cash-flow data is unavailable because the FMP API key is missing.",
      periodRequested: "annual",
      metrics: metricDefinitions.map((definition) =>
        createMetric({
          key: definition.key,
          label: definition.label,
          status: "error",
          message: `${definition.label} is unavailable because the FMP API key is missing.`,
        }),
      ),
    };
  }

  const fundamentalsResult = await fetchFmpFundamentals({
    ticker,
    period: "annual",
    limit: 1,
    apiKey,
  });

  return buildCashFlowSummary({
    ticker,
    fundamentalsResult,
    periodRequested: "annual",
  });
}
