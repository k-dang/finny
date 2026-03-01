export type Period = "annual" | "quarterly" | "ttm";

export type FilingType = "10-K" | "10-Q" | "8-K";

export type ProvenanceRecord = {
  provider: "fmp" | "sec";
  url: string;
  retrievedAt: string;
  asOfDate?: string;
  ticker?: string;
  filingType?: FilingType;
  accessionNumber?: string;
};

export type FinanceCoreResult<T> = {
  data: T | null;
  error: boolean;
  message?: string;
  provenance?: ProvenanceRecord[];
};
