import type { FinanceCoreResult, ProvenanceRecord } from "./types";

type ResultOptions = {
  message?: string;
  provenance?: ProvenanceRecord[];
};

export function okResult<T>(
  data: T,
  options?: ResultOptions,
): FinanceCoreResult<T> {
  return {
    data,
    error: false,
    message: options?.message,
    provenance: options?.provenance,
  };
}

export function failResult<T = never>(
  message: string,
  options?: { data?: T | null; provenance?: ProvenanceRecord[] },
): FinanceCoreResult<T> {
  return {
    data: options?.data ?? null,
    error: true,
    message,
    provenance: options?.provenance,
  };
}
