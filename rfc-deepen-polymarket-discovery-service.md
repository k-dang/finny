## Problem

The current Polymarket integration is split across several shallow modules:

- Gamma HTTP transport and wire normalization live in `gamma.ts` / `http.ts`.
- Active-event discovery behavior lives in `events.ts`.
- Market discovery, filtering, and pricing enrichment live in `markets.ts`.
- AI tool schemas and tool-specific caps live in the CLI layer.

These modules are tightly coupled around one concept: discovering useful Polymarket events and markets for analysis. Understanding or changing that concept requires bouncing between transport code, wire normalization, duplicated validation, filtering policy, computed pricing fields, and tool response shaping.

The integration risk is in the seams:

- `events.ts` and `markets.ts` duplicate query normalization, positive-limit validation, max-limit checks, min-volume/min-liquidity validation, error formatting, timestamp/disclaimer shaping, and text matching.
- Tool schemas enforce their own limits while package functions enforce package limits, so caller policy is split.
- Gamma API quirks are visible too widely: query parameter names, JSON-encoded array fields, loose string/number fields, malformed optional data, and endpoint response shapes.
- Existing tests cover narrow pieces such as Gamma URL mapping, `normalizeMarket`, event filtering, and market filtering separately. Those tests are useful, but the real user-facing behavior is the composed discovery service.

This makes the codebase harder to navigate because the public mental model is "Polymarket discovery," while the implementation is organized around many shallow technical steps.

## Proposed Interface

Introduce one Polymarket service/client that owns all current and future Polymarket use cases behind a single module boundary.

```ts
export type PolymarketService = {
  activeEvents(
    input?: PolymarketActiveEventsInput,
  ): Promise<PolymarketActiveEventsResult>;

  markets(input?: PolymarketMarketsInput): Promise<PolymarketMarketsResult>;
};

export type GammaPolymarketClient = {
  listEvents(params: ListEventsParams): Promise<PolymarketEvent[]>;
  listMarkets(params: ListMarketsParams): Promise<PolymarketMarket[]>;
};

export type PolymarketServiceLimits = {
  events?: {
    default?: number;
    max?: number;
  };
  markets?: {
    default?: number;
    max?: number;
  };
};

export type CreatePolymarketServiceOptions = {
  gammaClient?: GammaPolymarketClient;
  now?: () => Date;
  limits?: PolymarketServiceLimits;
  disclaimer?: string;
};

export function createPolymarketService(
  options?: CreatePolymarketServiceOptions,
): PolymarketService;
```

Usage from the CLI tools:

```ts
const polymarket = createPolymarketService({
  limits: {
    events: { max: 30 },
    markets: { max: 50 },
  },
});

export const polymarketTools = {
  polymarket_active_events: tool({
    description: "List current active Polymarket events...",
    inputSchema: polymarketActiveEventsToolInputSchema,
    execute: (input) => polymarket.activeEvents(input),
  }),

  polymarket_markets: tool({
    description: "List Polymarket markets...",
    inputSchema: polymarketMarketsToolInputSchema,
    execute: (input) => polymarket.markets(input),
  }),
};
```

Usage in package tests:

```ts
const polymarket = createPolymarketService({
  gammaClient: {
    listEvents: async () => eventFixtures,
    listMarkets: async () => marketFixtures,
  },
  now: () => new Date("2026-01-01T00:00:00.000Z"),
});

const result = await polymarket.markets({
  query: "fed rates",
  activeOnly: true,
  acceptingOrdersOnly: true,
  requireTokenIds: true,
});
```

The service should hide:

- Gamma endpoint selection and query-param mapping.
- Gamma wire-field coercion and malformed optional fields.
- Shared input normalization and validation.
- Event and market text matching.
- Event market-count computation.
- Market midpoint and spread-bps computation.
- Stable `{ ok: true } | { ok: false, error }` result shaping.
- Generated timestamp and disclaimer policy.

The package may keep compatibility exports such as `listPolymarketActiveEvents()` and `listPolymarketMarkets()` temporarily, but those should become thin wrappers around a default service instance rather than independent implementations.

## Dependency Strategy

Dependency category: **True external / Mock**.

Polymarket Gamma is a third-party external API. The deep module should depend on an injected Gamma client port:

```ts
export type GammaPolymarketClient = {
  listEvents(params: ListEventsParams): Promise<PolymarketEvent[]>;
  listMarkets(params: ListMarketsParams): Promise<PolymarketMarket[]>;
};
```

Production uses a Gamma HTTP adapter backed by the current `listEvents` and `listMarkets` behavior. Tests use an in-memory fake Gamma client returning domain fixtures.

Recommended dependency shape:

- `createGammaPolymarketClient({ fetchFn, baseUrl, timeoutMs })` owns HTTP transport and Gamma-specific URL/query mapping.
- `createPolymarketService({ gammaClient, now, limits })` owns discovery behavior and result shaping.
- Tool code depends only on `PolymarketService`, not directly on Gamma transport.

The service should also accept `now` so `generatedAt` is deterministic in tests.

## Testing Strategy

### New boundary tests to write

Write tests against `createPolymarketService()` with fake Gamma clients:

- `activeEvents()`:
  - applies default limit, max limit, min-volume, and min-liquidity validation
  - requests Gamma events with active/open filters
  - filters returned events to active and not closed
  - matches multi-term text queries against title and slug
  - computes `marketCount`, `openMarkets`, and `acceptingOrderMarkets`
  - returns deterministic `generatedAt` when `now` is injected
  - returns stable `{ ok: false, error }` for validation and Gamma errors

- `markets()`:
  - applies default limit, max limit, min-volume, and min-liquidity validation
  - requests Gamma markets with the correct high-level params
  - filters active/open markets when `activeOnly` is true
  - filters accepting-order markets when `acceptingOrdersOnly` is true
  - filters markets without CLOB token IDs when `requireTokenIds` is true
  - matches multi-term text queries against question and slug
  - computes `midpoint` from best bid/ask
  - computes `spreadBps` from explicit spread when present, otherwise bid/ask and midpoint
  - returns null midpoint/spread when pricing data is incomplete

- Gamma adapter tests:
  - maps service/domain params to Gamma query params
  - normalizes JSON-encoded arrays and numeric string fields
  - throws stable adapter errors for non-array payloads, HTTP errors, invalid JSON, and timeouts

### Old tests to delete or collapse

Once the service boundary tests cover the behavior, delete or collapse redundant narrow tests from:

- `packages/polymarket/tests/events.test.ts`
- `packages/polymarket/tests/markets.test.ts`

Keep only adapter-specific tests from `gamma.test.ts` that verify external API mapping and wire normalization. Avoid testing shared validators through separate private helper exports; test validation through the service methods.

### Test environment needs

No live Polymarket API calls are needed. Tests should use:

- fake `GammaPolymarketClient` implementations for service tests
- fake `fetchFn` for Gamma adapter tests
- injected `now` for deterministic timestamps

## Implementation Recommendations

The Polymarket service should own the domain-level use cases:

- active event discovery
- market discovery
- shared input normalization and validation
- discovery result shaping for AI/tool callers
- computed market/event summary fields
- stable error responses

It should hide:

- Gamma URL construction and query parameter names
- HTTP timeout/fetch details
- wire-shape coercion
- JSON-encoded array parsing
- duplicated validation/filtering helpers
- timestamp and disclaimer mechanics

It should expose:

- one service factory, `createPolymarketService()`
- a small service object with methods for current use cases, starting with `activeEvents()` and `markets()`
- a Gamma client port for test substitution
- optional compatibility functions that delegate to the default service

Migration guidance:

1. Add the service factory and Gamma client port without changing callers.
2. Move duplicated normalization, validation, matching, error formatting, timestamp, and disclaimer logic behind the service.
3. Reimplement `listPolymarketActiveEvents()` and `listPolymarketMarkets()` as wrappers around `createPolymarketService()` to preserve package exports.
4. Update CLI tools to create one `PolymarketService` and call its methods.
5. Replace old event/market tests with service boundary tests using fake Gamma clients.
6. Keep Gamma adapter tests focused only on HTTP, URL/query mapping, and wire normalization.

Prefer the name `PolymarketService` or `PolymarketClient` consistently. If the module is expected to grow beyond read-only discovery into order-book or trading workflows, use `PolymarketService` for the high-level facade and reserve `GammaPolymarketClient` for the upstream adapter.
