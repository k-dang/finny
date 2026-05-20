export type IbkrGatewayOptions = {
  baseUrl?: string;
  verifyTls?: boolean;
  fetchFn?: typeof fetch;
  gatewayClient?: IbkrGatewayPort;
};

export type IbkrResult<T> =
  | { ok: true; data: T; warnings?: string[] }
  | {
      ok: false;
      code:
        | "authentication_required"
        | "gateway_unreachable"
        | "invalid_gateway_response"
        | "request_failed";
      message: string;
    };

export type IbkrGatewayPort = {
  get(path: string): Promise<unknown>;

};

export type IbkrAccountList = {
  accounts: string[];
};

export type IbkrBalanceSummary = {
  currency: unknown;
  netLiquidation: unknown;
  cashBalance: unknown;
  availableFunds: unknown;
};

export type IbkrStockPosition = {
  conid: string;
  symbol: string;
  companyName: string;
  marketValue: unknown;
  rawPosition: Record<string, unknown>;
  rawContract?: Record<string, unknown>;
};

export type IbkrPortfolioSnapshot = {
  accountId: string;
  generatedAt: string;
  accountSelection: "explicit" | "first_available";
  summary: Record<string, unknown>;
  balance: IbkrBalanceSummary;
  positions?: Record<string, unknown>[];
  stockPositions?: IbkrStockPosition[];
};

export type IbkrPortfolioService = {
  accounts(): Promise<IbkrResult<IbkrAccountList>>;
  snapshot(input?: {
    accountId?: string;
    includePositions?: boolean;
    includeStockDetails?: boolean;
  }): Promise<IbkrResult<IbkrPortfolioSnapshot>>;
  stockPositions(input?: {
    accountId?: string;
  }): Promise<
    IbkrResult<{ accountId: string; positions: IbkrStockPosition[] }>
  >;
};

const DEFAULT_BASE_URL = "https://localhost:5000";

export class IbkrGatewayError extends Error {
  readonly code: Exclude<IbkrResult<never>, { ok: true }>["code"];

  constructor(code: IbkrGatewayError["code"], message: string) {
    super(message);
    this.name = "IbkrGatewayError";
    this.code = code;
  }
}

export function createIbkrPortfolioService(
  options: IbkrGatewayOptions = {},
): IbkrPortfolioService {
  const gatewayClient =
    options.gatewayClient ?? createIbkrGatewayClient(options);

  const checkAuth = async (): Promise<void> => {
    const ticklePayload = await gatewayClient
      .get("/v1/api/tickle")
      .catch(() => null);
    if (isAuthenticatedPayload(ticklePayload)) return;

    const authPayload = await gatewayClient
      .get("/v1/api/iserver/auth/status")
      .catch(() => null);
    if (isAuthenticatedPayload(authPayload)) return;

    throw new IbkrGatewayError(
      "authentication_required",
      "IBKR authentication required. Log in to TWS/IB Gateway and keep Client Portal running.",
    );
  };

  const accountsOrThrow = async (): Promise<string[]> => {
    await checkAuth();
    const payload = await gatewayClient.get("/v1/api/portfolio/accounts");

    if (isRecord(payload) && Array.isArray(payload.accounts)) {
      return normalizeAccountIds(payload.accounts);
    }

    if (Array.isArray(payload)) {
      return normalizeAccountIds(payload);
    }

    throw new IbkrGatewayError(
      "invalid_gateway_response",
      "Unexpected accounts response format.",
    );
  };

  const selectAccount = async (
    requested?: string,
  ): Promise<{
    accountId: string;
    selection: "explicit" | "first_available";
    warnings: string[];
  }> => {
    const normalized = requested?.trim();
    if (normalized) {
      await checkAuth();
      return { accountId: normalized, selection: "explicit", warnings: [] };
    }

    const accounts = await accountsOrThrow();
    const first = accounts[0];
    if (!first) {
      throw new IbkrGatewayError(
        "invalid_gateway_response",
        "No account ids found in IBKR response.",
      );
    }

    return {
      accountId: first,
      selection: "first_available",
      warnings:
        accounts.length > 1
          ? [
              "Multiple accounts found; using the first. Pass accountId to choose.",
            ]
          : [],
    };
  };

  const getPositions = async (
    accountId: string,
  ): Promise<Record<string, unknown>[]> => {
    const payload = await gatewayClient.get(
      `/v1/api/portfolio2/${accountId}/positions`,
    );
    if (Array.isArray(payload)) return payload.filter(isRecord);
    if (isRecord(payload) && Array.isArray(payload.positions))
      return payload.positions.filter(isRecord);
    throw new IbkrGatewayError(
      "invalid_gateway_response",
      "Unexpected positions response format.",
    );
  };

  const getContractDetails = async (
    conids: (string | number)[],
  ): Promise<Record<string, unknown>[]> => {
    if (conids.length === 0) return [];
    const payload = await gatewayClient.get(
      `/v1/api/trsrv/secdef?conids=${conids.join(",")}`,
    );
    if (isRecord(payload) && Array.isArray(payload.secdef))
      return payload.secdef.filter(isRecord);
    throw new IbkrGatewayError(
      "invalid_gateway_response",
      "Unexpected contract details response format.",
    );
  };

  const stockPositionsOrThrow = async (
    accountId: string,
  ): Promise<IbkrStockPosition[]> => {
    const positions = (await getPositions(accountId)).filter(
      (position) => position.secType === "STK",
    );
    const conids = positions
      .map((position) => position.conid)
      .filter(isStringOrNumber);
    const details = await getContractDetails(conids);
    const detailsByConid = new Map<string, Record<string, unknown>>();
    for (const detail of details) {
      const conid = detail.conid;
      if (isStringOrNumber(conid)) detailsByConid.set(String(conid), detail);
    }

    return positions.map((position) => {
      const conid = isStringOrNumber(position.conid)
        ? String(position.conid)
        : "";
      const detail = detailsByConid.get(conid);
      return {
        conid,
        symbol: stringValue(detail?.ticker ?? position.description),
        companyName: stringValue(detail?.name),
        marketValue: position.marketValue ?? null,
        rawPosition: position,
        rawContract: detail,
      };
    });
  };

  return {
    async accounts() {
      try {
        return { ok: true, data: { accounts: await accountsOrThrow() } };
      } catch (error) {
        return resultFromError(error);
      }
    },

    async snapshot(input = {}) {
      try {
        const selected = await selectAccount(input.accountId);
        const summaryPayload = await gatewayClient.get(
          `/v1/api/portfolio/${selected.accountId}/summary`,
        );
        if (!isRecord(summaryPayload)) {
          throw new IbkrGatewayError(
            "invalid_gateway_response",
            "Unexpected account summary format.",
          );
        }

        const positions = input.includePositions
          ? await getPositions(selected.accountId)
          : undefined;
        const stockPositions = input.includeStockDetails
          ? await stockPositionsOrThrow(selected.accountId)
          : undefined;

        return {
          ok: true,
          data: {
            accountId: selected.accountId,
            generatedAt: new Date().toISOString(),
            accountSelection: selected.selection,
            summary: summaryPayload,
            balance: extractBalance(summaryPayload),
            positions,
            stockPositions,
          },
          warnings:
            selected.warnings.length > 0 ? selected.warnings : undefined,
        };
      } catch (error) {
        return resultFromError(error);
      }
    },

    async stockPositions(input = {}) {
      try {
        const selected = await selectAccount(input.accountId);
        return {
          ok: true,
          data: {
            accountId: selected.accountId,
            positions: await stockPositionsOrThrow(selected.accountId),
          },
          warnings:
            selected.warnings.length > 0 ? selected.warnings : undefined,
        };
      } catch (error) {
        return resultFromError(error);
      }
    },
  };
}

function createIbkrGatewayClient(
  options: IbkrGatewayOptions = {},
): IbkrGatewayPort {
  const {
    baseUrl = DEFAULT_BASE_URL,
    verifyTls = false,
    fetchFn = fetch,
  } = options;
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  const requestJson = async (
    method: "GET" | "POST",
    path: string,
    payload?: Record<string, unknown>,
  ): Promise<unknown> => {
    const url = `${normalizedBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    let response: Response;
    try {
      response = await fetchFn(url, {
        method,
        headers: payload ? { "content-type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
        tls: { rejectUnauthorized: verifyTls },
      } as RequestInit);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new IbkrGatewayError(
        "gateway_unreachable",
        `Unable to reach IBKR gateway at ${normalizedBaseUrl}. Details: ${message}`,
      );
    }

    if (!response.ok) {
      const body = await response.text();
      throw new IbkrGatewayError(
        response.status === 401 || response.status === 403
          ? "authentication_required"
          : "request_failed",
        `IBKR gateway error (${response.status}) for ${path}: ${body}`,
      );
    }

    try {
      return (await response.json()) as unknown;
    } catch {
      throw new IbkrGatewayError(
        "invalid_gateway_response",
        `Invalid JSON response for ${path}.`,
      );
    }
  };

  return {
    get: (path) => requestJson("GET", path),
  };
}

function resultFromError(
  error: unknown,
): Exclude<IbkrResult<never>, { ok: true }> {
  if (error instanceof IbkrGatewayError) {
    return { ok: false, code: error.code, message: error.message };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, code: "request_failed", message };
}

function normalizeAccountIds(accounts: unknown[]): string[] {
  const normalized: string[] = [];
  for (const item of accounts) {
    if (typeof item === "string") {
      normalized.push(item);
    } else if (isRecord(item)) {
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
    throw new IbkrGatewayError(
      "invalid_gateway_response",
      "No account ids found in IBKR response.",
    );
  }
  return normalized;
}

function extractBalance(summary: Record<string, unknown>): IbkrBalanceSummary {
  const fields = new Map<string, unknown>();
  for (const [key, value] of Object.entries(summary))
    fields.set(key.toLowerCase(), value);
  return {
    currency: getField(fields, ["currency", "baseCurrency", "base_currency"]),
    netLiquidation: getField(fields, [
      "NetLiquidation",
      "net_liquidation",
      "netLiquidation",
    ]),
    cashBalance: getField(fields, [
      "TotalCashValue",
      "cash_balance",
      "cashBalance",
    ]),
    availableFunds: getField(fields, [
      "AvailableFunds",
      "available_funds",
      "availableFunds",
    ]),
  };
}

function getField(fields: Map<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const lowered = key.toLowerCase();
    if (fields.has(lowered)) return fields.get(lowered);
  }
  return null;
}

function isAuthenticatedPayload(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  if (payload.status === "ok" || payload.authenticated === true) return true;
  if (isRecord(payload.iserver)) {
    const authStatus = payload.iserver.authStatus;
    if (isRecord(authStatus) && authStatus.authenticated === true) return true;
  }
  return (
    isRecord(payload.authStatus) && payload.authStatus.authenticated === true
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringOrNumber(value: unknown): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
