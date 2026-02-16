import type { FetchLike } from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;

export class PolymarketApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolymarketApiError";
  }
}

export async function requestPolymarketJson<T>(options: {
  fetchFn: FetchLike;
  url: string;
  timeoutMs?: number;
}): Promise<T> {
  const { fetchFn, url, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new PolymarketApiError(
        `Polymarket API error (${response.status}) for ${url}: ${body}`,
      );
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new PolymarketApiError(`Invalid JSON response for ${url}.`);
    }
  } catch (error) {
    if (error instanceof PolymarketApiError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new PolymarketApiError(`Failed to fetch ${url}. Details: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export function buildUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${normalizedBaseUrl}${normalizedPath}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
