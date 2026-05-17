## Problem

The FMP provider is currently split across several shallow modules:

- FMP HTTP/request construction
- fundamentals
- ratios
- estimates
- earnings
- insider trades
- revenue segments

Each endpoint module repeats the same workflow: normalize the ticker, build one or more FMP requests, translate period terminology, handle FMP plan-limit fallbacks, extract an as-of date, wrap the output in `FinanceCoreResult`, attach provenance, and convert thrown errors into failed results.

This creates integration risk in the seams between files. The important behavior is not the isolated helpers; it is the full provider contract: given a provider request, return stable domain-shaped data plus provenance despite FMP endpoint quirks. Today, understanding or changing that contract requires bouncing between many small files and re-checking repeated conventions.

The most obvious duplication/friction:

- ticker normalization is repeated per endpoint
- `okResult` / `failResult` wrapping is repeated per endpoint
- provenance construction is repeated per endpoint
- `asOfDate` extraction is repeated with slightly different helper names
- FMP period mapping is split across fundamentals, ratios, and segments
- quarterly plan-limit fallback behavior is duplicated between ratios and segments
- multi-request orchestration for fundamentals is isolated from the rest of the provider workflow

This makes tests less valuable when they target tiny helpers. The bugs most likely to matter are provider-boundary bugs: wrong URL/query, wrong fallback, wrong provenance, wrong period resolution, or incorrect error shaping.

## Proposed Interface

Introduce a deep FMP provider module with a small public interface:

```ts
export type FmpProvider = {
  fundamentals(input: {
    ticker: string;
    period: "annual" | "quarterly" | "ttm";
    limit: number;
  }): Promise<FinanceCoreResult<FmpFundamentalsPayload>>;

  ratios(input: {
    ticker: string;
    period: "annual" | "quarterly" | "ttm";
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
  fetchFn?: typeof fetch;
  now?: () => Date;
}): FmpProvider;
```

Usage:

```ts
const fmp = createFmpProvider({
  apiKey: process.env.FMP_API_KEY,
});

const fundamentals = await fmp.fundamentals({
  ticker: "AAPL",
  period: "ttm",
  limit: 4,
});

const ratios = await fmp.ratios({
  ticker: "MSFT",
  period: "quarterly",
  limit: 8,
});
```

Replace the existing endpoint-level `fetchFmp*` exports with this provider interface. Callers should be migrated directly rather than routed through compatibility wrappers.

The deep module should hide:

- FMP base URL and endpoint paths
- API key enforcement
- query serialization
- fetch/JSON/error handling
- ticker normalization
- period mapping and period resolution
- FMP plan-limit fallback behavior
- provenance construction
- as-of-date extraction
- `okResult` / `failResult` wrapping
- multi-request orchestration for fundamentals

Internally, the module may use private helpers such as:

- `requestJson`
- `withFmpResult`
- `makeProvenance`
- `extractFirstDate`
- `isPlanLimitPeriodError`
- `resolvePeriod`

These helpers should stay private unless another provider needs the same abstraction.

## Dependency Strategy

Dependency category: **True external / Mock**.

FMP is a third-party API. The deep provider should depend on FMP through an injected transport boundary:

- production uses the global `fetch`
- tests inject `fetchFn`
- tests may inject `now` for deterministic provenance assertions

The module should not expose an HTTP client or request-plan framework publicly. FMP transport details are implementation details of the provider.

The only public construction dependency should be:

```ts
createFmpProvider({ apiKey, fetchFn, now })
```

## Testing Strategy

### New boundary tests to write

Write tests against `createFmpProvider` using mocked `fetchFn` responses.

Recommended behaviors:

- `fundamentals`:
  - normalizes ticker
  - requests income statement, balance sheet, and cash flow in parallel or as one logical operation
  - maps `ttm`/`quarterly` to FMP quarter mode
  - returns statements under the normalized ticker
  - emits one provenance record per source URL
  - uses the first available statement date as `asOfDate`

- `ratios`:
  - calls `/ratios-ttm` for `period: "ttm"`
  - maps `quarterly` to FMP `quarter`
  - falls back from quarterly to annual when FMP returns the known plan-limit period error
  - returns the fallback message and `periodResolved: "annual"`

- `segments`:
  - maps `quarterly` to FMP `quarter`
  - falls back to annual for the known plan-limit period error
  - slices records to the requested limit

- `estimates`, `earnings`, and `insiderTrades`:
  - normalize ticker
  - filter ticker-specific records where applicable
  - return deterministic provenance
  - produce endpoint-specific messages such as no matching insider trades

- errors:
  - missing API key returns a failed `FinanceCoreResult`
  - non-OK HTTP response returns a failed `FinanceCoreResult`
  - invalid/mocked network errors return a failed `FinanceCoreResult`

### Old tests to delete

There are currently no endpoint-specific FMP tests in the repo. If helper-level FMP tests are added before this refactor, delete or avoid tests that assert private helper behavior once provider-boundary tests exist.

Keep generic result-helper tests for `okResult` and `failResult`; they are not redundant with the FMP provider boundary.

### Test environment needs

No live FMP credentials should be required for unit tests.

Tests need:

- fake `fetchFn`
- deterministic `now`
- fixture JSON payloads for each FMP endpoint
- possibly a small response-builder helper for mocked `Response` objects

## Implementation Recommendations

The FMP provider module should own the provider workflow end-to-end. It should expose a small operation-oriented interface and keep request mechanics private.

Responsibilities the module should own:

- converting caller input into FMP requests
- normalizing symbols/tickers
- mapping domain periods to FMP-specific period query values
- applying provider-specific fallback behavior
- assembling multi-response results
- shaping `FinanceCoreResult` outputs
- creating provenance
- converting thrown transport/provider errors into failed results

Implementation guidance:

1. Add `createFmpProvider` as the new primary interface.
2. Move endpoint behavior behind methods on the provider object.
3. Remove the existing `fetchFmp*` endpoint-level exports and migrate callers directly to the provider object.
4. Inject `fetchFn` and `now` through the provider constructor; keep the FMP base URL as an internal constant.
5. Keep payload types exported if current callers rely on them, but avoid exporting internal request/response helpers unless there is a clear second consumer.
6. Prefer boundary tests through `createFmpProvider` over tests for private helpers.
7. After the provider boundary is covered, simplify or remove duplicated endpoint-local helpers.

Callers should migrate from:

```ts
await fetchFmpRatios({ ticker, period, limit, apiKey });
```

to:

```ts
const fmp = createFmpProvider({ apiKey });
await fmp.ratios({ ticker, period, limit });
```

The CLI financial tools should create an FMP provider with `process.env.FMP_API_KEY` and call provider methods directly.
