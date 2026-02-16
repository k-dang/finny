import type {
  IbkrClient,
  IbkrContractSearchQuery,
  IbkrOrderQuery,
  IbkrRequestOptions,
  IbkrTransactionQuery,
} from "./types";

const DEFAULT_BASE_URL = "https://localhost:5000";
const DEFAULT_TIMEOUT_MS = 10_000;

export class IbkrClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IbkrClientError";
  }
}

export function createIbkrClient(options: IbkrRequestOptions = {}): IbkrClient {
  const {
    baseUrl = DEFAULT_BASE_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    verifyTls = true,
    fetchFn = fetch,
  } = options;

  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  const withTimeout = async (
    input: string,
    init: RequestInit,
  ): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchFn(input, {
        ...init,
        signal: controller.signal,
        // Bun supports this extension for TLS behavior.
        tls: { rejectUnauthorized: verifyTls },
      } as RequestInit);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new IbkrClientError(
        `Unable to reach IBKR gateway at ${normalizedBaseUrl}. Details: ${message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  };

  const requestJson = async (
    method: "GET" | "POST",
    path: string,
    payload?: Record<string, unknown>,
  ): Promise<unknown> => {
    const url = buildUrl(normalizedBaseUrl, path);
    const response = await withTimeout(url, {
      method,
      headers: payload
        ? {
            "content-type": "application/json",
          }
        : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new IbkrClientError(
        `IBKR gateway error (${response.status}) for ${path}: ${body}`,
      );
    }

    try {
      return (await response.json()) as unknown;
    } catch {
      throw new IbkrClientError(`Invalid JSON response for ${path}.`);
    }
  };

  const get = (path: string) => requestJson("GET", path);
  const post = (path: string, payload: Record<string, unknown>) =>
    requestJson("POST", path, payload);

  const checkAuth = async (): Promise<void> => {
    const ticklePayload = await get("/v1/api/tickle").catch(() => null);
    if (isAuthenticatedPayload(ticklePayload)) {
      return;
    }

    const authPayload = await get("/v1/api/iserver/auth/status").catch(
      () => null,
    );
    if (isAuthenticatedPayload(authPayload)) {
      return;
    }

    throw new IbkrClientError(
      "Not authenticated. Log in to TWS/IB Gateway and ensure Client Portal is running.",
    );
  };

  const getAccounts = async (): Promise<string[]> => {
    const payload = await get("/v1/api/portfolio/accounts");
    return extractAccounts(payload);
  };

  const getAccountSummary = async (
    accountId: string,
  ): Promise<Record<string, unknown>> => {
    const payload = await get(`/v1/api/portfolio/${accountId}/summary`);
    if (!isRecord(payload)) {
      throw new IbkrClientError("Unexpected account summary format.");
    }
    return payload;
  };

  const getPositions = async (
    accountId: string,
  ): Promise<Record<string, unknown>[]> => {
    const payload = await get(`/v1/api/portfolio2/${accountId}/positions`);
    if (Array.isArray(payload)) {
      return payload.filter(isRecord);
    }

    if (isRecord(payload) && Array.isArray(payload.positions)) {
      return payload.positions.filter(isRecord);
    }

    throw new IbkrClientError("Unexpected positions response format.");
  };

  const getOrders = async (
    query: IbkrOrderQuery = {},
  ): Promise<Record<string, unknown>> => {
    await get("/v1/api/iserver/accounts");

    const params = new URLSearchParams();
    if (query.accountId) {
      params.set("accountId", query.accountId);
    }
    if (query.filters) {
      params.set("filters", query.filters);
    }
    if (query.force === true) {
      params.set("force", "true");
    }

    const path = `/v1/api/iserver/account/orders${params.size > 0 ? `?${params}` : ""}`;
    const payload = await get(path);
    if (!isRecord(payload)) {
      throw new IbkrClientError("Unexpected orders response format.");
    }
    return payload;
  };

  const getTransactions = async (
    query: IbkrTransactionQuery,
  ): Promise<Record<string, unknown> | unknown[]> => {
    const payload: Record<string, unknown> = {
      acctIds: [query.accountId],
      conids: [query.conid],
      currency: query.currency ?? "USD",
    };

    if (query.days !== undefined) {
      payload.days = query.days;
    }

    const data = await post("/v1/api/pa/transactions", payload);
    if (!isRecord(data) && !Array.isArray(data)) {
      throw new IbkrClientError("Unexpected transactions response format.");
    }

    return data;
  };

  const searchContracts = async (
    query: IbkrContractSearchQuery,
  ): Promise<Record<string, unknown>[]> => {
    const params = new URLSearchParams({
      symbol: query.symbol,
      secType: query.secType ?? "STK",
    });
    if (query.name) {
      params.set("name", query.name);
    }
    if (query.exchange) {
      params.set("exchange", query.exchange);
    }
    if (query.currency) {
      params.set("currency", query.currency);
    }

    const payload = await get(`/v1/api/iserver/secdef/search?${params}`);
    if (!Array.isArray(payload)) {
      throw new IbkrClientError("Unexpected contract search response format.");
    }

    return payload.filter(isRecord);
  };

  return {
    checkAuth,
    getAccounts,
    getAccountSummary,
    getPositions,
    getOrders,
    getTransactions,
    searchContracts,
  };
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractAccounts(payload: unknown): string[] {
  if (isRecord(payload) && Array.isArray(payload.accounts)) {
    return normalizeAccounts(payload.accounts);
  }

  if (Array.isArray(payload)) {
    return normalizeAccounts(payload);
  }

  throw new IbkrClientError("Unexpected accounts response format.");
}

export function normalizeAccounts(accounts: unknown[]): string[] {
  const normalized: string[] = [];

  for (const item of accounts) {
    if (typeof item === "string") {
      normalized.push(item);
      continue;
    }

    if (isRecord(item)) {
      for (const key of ["accountId", "account_id", "id"]) {
        const value = item[key];
        if (typeof value === "string") {
          normalized.push(value);
          break;
        }
      }
    }
  }

  if (normalized.length === 0) {
    throw new IbkrClientError("No account ids found in IBKR response.");
  }

  return normalized;
}

export function isAuthenticatedPayload(payload: unknown): boolean {
  if (!isRecord(payload)) {
    return false;
  }

  if (payload.status === "ok" || payload.authenticated === true) {
    return true;
  }

  if (isRecord(payload.iserver)) {
    const authStatus = payload.iserver.authStatus;
    if (isRecord(authStatus) && authStatus.authenticated === true) {
      return true;
    }
  }

  if (
    isRecord(payload.authStatus) &&
    payload.authStatus.authenticated === true
  ) {
    return true;
  }

  return false;
}
