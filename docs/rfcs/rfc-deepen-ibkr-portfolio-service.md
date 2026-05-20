## Problem

The IBKR integration currently exposes a low-level gateway client, but the higher-level portfolio/account workflow is spread across multiple callers.

- `packages/ibkr` knows Client Portal Gateway transport concerns: base URL handling, Bun TLS options, timeout behavior, endpoint paths, request/response JSON handling, authentication probes, account payload variants, and raw response validation.
- CLI commands independently compose gateway operations into user-facing workflows: authenticate, list accounts, choose an account, read summary, extract balance fields, fetch positions, fetch contract details, enrich stock positions, and render JSON/CSV.
- AI chat tools separately compose similar account/snapshot operations and maintain their own recoverable error taxonomy.

The shallow seam is the exported HTTP-ish `IbkrClient`: it exposes many endpoint-shaped methods returning raw `Record<string, unknown>` payloads, while callers own meaningful IBKR concepts such as “portfolio snapshot”, “account selection”, “balance summary”, and “stock position export”.

This creates integration risk in the seams between transport, payload normalization, account selection, error mapping, and caller formatting. Bugs are more likely in the choreography than in isolated helpers like `extractAccounts` or `isAuthenticatedPayload`, but the existing tests mostly exercise those shallow helpers and some URL construction behavior.

## Proposed Interface

Create a deeper portfolio-focused module backed by a gateway port.

```ts
export type IbkrGatewayOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  verifyTls?: boolean;
  fetchFn?: typeof fetch;
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
  post(path: string, payload: Record<string, unknown>): Promise<unknown>;
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

export type IbkrPortfolioSnapshot = {
  accountId: string;
  generatedAt: string;
  accountSelection: "explicit" | "first_available";
  summary: Record<string, unknown>;
  balance: IbkrBalanceSummary;
  positions?: Record<string, unknown>[];
  stockPositions?: IbkrStockPosition[];
};

export type IbkrStockPosition = {
  conid: string;
  symbol: string;
  companyName: string;
  marketValue: unknown;
  rawPosition: Record<string, unknown>;
  rawContract?: Record<string, unknown>;
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
  }): Promise<IbkrResult<{ accountId: string; positions: IbkrStockPosition[] }>>;
};

export function createIbkrPortfolioService(options?: IbkrGatewayOptions): IbkrPortfolioService;

export function createIbkrPortfolioServiceFromGateway(deps: {
  gateway: IbkrGatewayPort;
}): IbkrPortfolioService;

export function createIbkrHttpGatewayAdapter(options?: IbkrGatewayOptions): IbkrGatewayPort;
```

`createIbkrPortfolioService()` and `createIbkrHttpGatewayAdapter()` should carry the production defaults:

- `baseUrl`: `"https://localhost:5000"`
- `timeoutMs`: `10_000`
- `verifyTls`: `false`
- `fetchFn`: global `fetch`

`createIbkrPortfolioServiceFromGateway()` is the lower-level test/adapter constructor. Its `gateway` dependency is intentionally required; callers that want defaults should use `createIbkrPortfolioService()` instead.

Usage example for CLI and AI tools:

```ts
const ibkr = createIbkrPortfolioService({ baseUrl, timeoutMs, verifyTls });

const result = await ibkr.snapshot({
  accountId: options.accountId,
  includePositions: true,
  includeStockDetails: true,
});

if (!result.ok) {
  console.error(result.message);
  process.exit(1);
}

console.log(result.data.balance.netLiquidation);
```

Usage example in tests:

```ts
const ibkr = createIbkrPortfolioServiceFromGateway({
  gateway: new FakeIbkrGateway()
    .onGet("/v1/api/tickle", { authenticated: true })
    .onGet("/v1/api/portfolio/accounts", { accounts: ["DU123"] })
    .onGet("/v1/api/portfolio/DU123/summary", {
      NetLiquidation: "100000",
      TotalCashValue: "25000",
      AvailableFunds: "50000",
      currency: "USD",
    }),
});

await expect(ibkr.snapshot()).resolves.toEqual({
  ok: true,
  data: expect.objectContaining({
    accountId: "DU123",
    generatedAt: expect.any(String),
    accountSelection: "first_available",
    balance: expect.objectContaining({ netLiquidation: "100000" }),
  }),
});
```

The interface hides:

- Client Portal Gateway endpoint paths.
- Authentication probing.
- Account payload normalization.
- First-account selection and warning generation.
- Summary balance field extraction across IBKR field-name variants.
- Position fetching and stock-position filtering.
- Contract-detail enrichment for stock positions.
- Low-level gateway failures mapped to stable recoverable error codes.

## Dependency Strategy

Dependency category: **Local-substitutable / Ports & adapters**.

The IBKR Client Portal Gateway is a local HTTP dependency. Treat it as a port so portfolio/account logic can be tested without a live gateway.

- `IbkrGatewayPort` is the boundary used by the deep portfolio module.
- `createIbkrHttpGatewayAdapter` is the production adapter. It owns HTTP fetch, base URL normalization, timeout, Bun TLS behavior, JSON parsing, HTTP status errors, and the default gateway settings (`https://localhost:5000`, `10_000` ms timeout, TLS verification off, global `fetch`).
- Tests use an in-memory gateway adapter that returns configured payloads and records requested paths.
- The portfolio service owns workflow semantics and normalization, not transport details.

This keeps the meaningful module in-process for tests while still supporting the real local gateway in production.

## Testing Strategy

### New boundary tests to write

Write tests against `createIbkrPortfolioServiceFromGateway` using an in-memory gateway adapter:

- `accounts()` returns account IDs from object and array gateway payload variants.
- `accounts()` returns `authentication_required` when auth probes fail.
- `snapshot()` with explicit `accountId` returns summary, balance fields, timestamp, and `accountSelection: "explicit"`.
- `snapshot()` without `accountId` selects the first account and includes a warning when multiple accounts are available.
- `snapshot({ includePositions: true })` includes raw positions.
- `snapshot({ includePositions: true, includeStockDetails: true })` filters stock positions, fetches contract details, and enriches symbol/company/market value.
- `stockPositions()` returns enriched stock positions suitable for CSV or AI-tool output.
- Malformed account, summary, positions, or contract-detail payloads return `invalid_gateway_response` with actionable messages.
- Gateway connectivity/request failures become stable `gateway_unreachable` or `request_failed` results.

Write focused adapter tests against `createIbkrHttpGatewayAdapter`:

- Builds URLs from base URL + path.
- Applies timeout/TLS options.
- Parses JSON.
- Surfaces HTTP status and invalid JSON failures.

### Old tests to delete or shrink

Once boundary tests exist, delete or reduce tests that only prove internal helper behavior:

- Direct tests for `normalizeAccounts`.
- Direct tests for `extractAccounts`.
- Direct tests for `isAuthenticatedPayload`.
- URL-construction assertions on endpoint-shaped client methods where the behavior is already covered by adapter tests.

If these helpers remain exported for compatibility during migration, mark them as legacy and keep only minimal compatibility tests until callers are migrated.

### Test environment needs

No live IBKR gateway should be required for unit tests.

Use:

- In-memory `IbkrGatewayPort` for portfolio service tests.
- Injected fake `fetchFn` for HTTP adapter tests.
- Optional manual smoke test against a real gateway for CLI verification.

## Implementation Recommendations

The deepened IBKR module should own:

- Authentication checks needed before read-only account/portfolio operations.
- Account listing and account selection semantics.
- Summary and balance normalization.
- Position retrieval and stock-position enrichment.
- Recoverable error code mapping for CLI and AI-tool callers.
- Stable portfolio/account result shapes.

The module should hide:

- Client Portal endpoint paths.
- Raw gateway response variants.
- Bun-specific TLS and timeout mechanics.
- Contract-detail lookup choreography.
- Field-name fallbacks for balance extraction.
- Differences between CLI and AI error handling.

The module should expose:

- A small portfolio-focused service: `accounts`, `snapshot`, and `stockPositions`.
- A production HTTP gateway adapter.
- A port-based constructor for tests and future adapters.

Migration path:

1. Add `IbkrGatewayPort`, `createIbkrHttpGatewayAdapter`, and `createIbkrPortfolioServiceFromGateway` inside `packages/ibkr`.
2. Implement `createIbkrPortfolioService(options)` as the default production constructor that wires the HTTP adapter into the portfolio service.
3. Keep the existing `createIbkrClient` temporarily for compatibility.
4. Migrate `apps/cli/src/chat/tools/ibkr.ts` to call `createIbkrPortfolioService().accounts()` and `.snapshot()` instead of composing `createIbkrClient` directly.
5. Migrate `apps/cli/src/commands/ibkr.ts`:
   - `ibkr check` should call `snapshot()` and print the returned balance/snapshot fields.
   - `ibkr positions` should call `stockPositions()` and render CSV from the returned normalized positions.
6. Replace shallow helper tests with portfolio-service boundary tests and small HTTP-adapter tests.
7. After callers are migrated, either remove `createIbkrClient` or keep it as an explicitly low-level escape hatch not used by CLI/chat workflows.
