## Problem

The Alpaca integration is currently split across low-level package functions and app-level command/tool glue:

- `packages/alpaca/src/http.ts` owns credential headers and HTTP error behavior.
- `packages/alpaca/src/stocks.ts` owns stock URLs, feed defaults, wire response normalization, and exported low-level functions.
- `packages/alpaca/src/options.ts` owns option URLs, option symbol parsing, chain normalization, sorting, and exported low-level functions.
- `apps/cli/src/commands/alpaca.ts` owns CLI-specific parsing, credential lookup, missing-symbol warnings, result payload shaping, and process exits.
- `apps/cli/src/chat/tools/alpaca.ts` duplicates credential lookup, symbol normalization, option defaults, error conversion, missing-symbol warnings, and tool-ready payload shaping.
- `apps/cli/src/utils/alpaca/helpers.ts` repeats parsing and credential concerns used by commands but not by tools.

The architectural friction is in the seams: callers need to know which low-level Alpaca package function to call, how to load credentials, how to normalize symbols, how to fill missing symbols with `null`, how to build warnings, how to choose defaults, and how to convert thrown network errors into user/tool-visible result envelopes.

This makes the integration harder to test at the meaningful boundary. Existing tests primarily validate pure normalizers such as `normalizeLatestTrades`, `normalizeStockSnapshots`, `parseOptionSymbol`, and `normalizeOptionChainResponse`. Those tests are useful but shallow: the real integration risk is whether the CLI and AI tools compose parsing, defaults, credentials, HTTP, normalization, warnings, and error handling consistently.

## Proposed Interface

Introduce a deep Alpaca market-data module with a service interface backed by a port/adapter split.

```ts
type AlpacaResult<T> =
  | { ok: true; data: T; warnings: string[] }
  | { ok: false; error: string };

type LatestPricesPayload = {
  symbols: string[];
  prices: Record<string, NormalizedPrice | null>;
};

type StockSnapshotsPayload = {
  symbols: string[];
  snapshots: Record<string, NormalizedStockSnapshot | null>;
};

type OptionChainPayload = {
  underlying: string;
  contracts: NormalizedOption[];
};

type AssetPayload = {
  asset: NormalizedAsset;
};

type AlpacaMarketDataService = {
  latestPrices(input: {
    symbols: string[];
    feed?: string;
  }): Promise<AlpacaResult<LatestPricesPayload>>;

  stockSnapshots(input: {
    symbols: string[];
    feed?: string;
  }): Promise<AlpacaResult<StockSnapshotsPayload>>;

  optionChain(input: {
    underlying: string;
    expiration?: string;
    type?: OptionType;
    limit?: number;
  }): Promise<AlpacaResult<OptionChainPayload>>;

  asset(input: {
    symbol: string;
  }): Promise<AlpacaResult<AssetPayload>>;
};

type AlpacaMarketDataPort = {
  latestTrades(input: {
    symbols: string[];
    feed: string;
  }): Promise<LatestTradesResponse>;

  stockSnapshots(input: {
    symbols: string[];
    feed: string;
  }): Promise<StockSnapshotsResponse>;

  optionSnapshots(input: {
    underlying: string;
    expiration?: string;
    type?: OptionType;
    limit?: number;
  }): Promise<OptionChainResponse>;

  asset(input: {
    symbol: string;
  }): Promise<AlpacaAsset>;
};

function createAlpacaMarketDataService(options: {
  port: AlpacaMarketDataPort;
  defaults?: {
    stockFeed?: string;
    optionLimit?: number;
  };
}): AlpacaMarketDataService;

function createAlpacaHttpAdapter(options: {
  credentials: AlpacaCredentials;
  fetchFn?: typeof fetch;
  baseUrls?: {
    stocksData?: string;
    optionsData?: string;
    trading?: string;
  };
}): AlpacaMarketDataPort;
```

Usage from the CLI app:

```ts
const credentials = getCredentialsFromEnv(process.env);
const marketData = createAlpacaMarketDataService({
  port: createAlpacaHttpAdapter({ credentials }),
});

const result = await marketData.latestPrices({
  symbols: parseSymbols(rawSymbols),
});

if (!result.ok) {
  failWithMessage(result.error);
}

outputJson(result.data);
```

Usage from AI tools:

```ts
const result = await marketData.optionChain({
  underlying: symbol,
  expiration,
  type,
  limit,
});

return result.ok
  ? { ok: true, ...result.data }
  : { ok: false, error: result.error };
```

The service hides:

- Alpaca wire response shapes.
- URL construction and feed/default selection.
- Symbol normalization and deduplication.
- Missing-symbol `null` filling and warnings.
- Option symbol parsing, option field normalization, and sorting.
- Error capture and formatting into a stable result envelope.

The HTTP adapter hides:

- Credential headers.
- Alpaca endpoint paths and query parameters.
- Non-2xx HTTP response parsing.
- Base URL overrides for tests or non-production environments.

## Dependency Strategy

Dependency category: **True external / Mock**.

Alpaca is a third-party external API. The deepened module should not test against live Alpaca for normal behavior. Instead:

- Define `AlpacaMarketDataPort` as the boundary between domain behavior and Alpaca transport.
- Implement `createAlpacaHttpAdapter()` for production HTTP access.
- Test `createAlpacaMarketDataService()` with an in-memory fake port that returns Alpaca wire-shaped payloads.
- Test the HTTP adapter separately with a fake `fetchFn` to verify URL construction, headers, query params, and HTTP error formatting.

Credential loading should remain outside `packages/alpaca`. The CLI app should own reading `ALPACA_API_KEY` and `ALPACA_API_SECRET` from the environment and pass explicit credentials into the HTTP adapter. This keeps `packages/alpaca` reusable and easier to test.

## Testing Strategy

### New boundary tests to write

For `createAlpacaMarketDataService()` with a fake port:

- `latestPrices` normalizes, deduplicates, and uppercases symbols.
- `latestPrices` fills missing symbols with `null` and returns warnings.
- `latestPrices` applies the default stock feed when none is provided.
- `latestPrices` returns `{ ok: false, error }` when the port throws.
- `stockSnapshots` returns caller-requested symbols with missing entries represented consistently.
- `optionChain` normalizes the underlying symbol, applies the default option limit, parses contracts, filters invalid option symbols, and sorts contracts.
- `asset` normalizes the requested symbol and returns a stable asset payload.

For `createAlpacaHttpAdapter()` with fake `fetchFn`:

- latest trades endpoint uses `/v2/stocks/trades/latest`, `symbols`, and `feed` query params.
- stock snapshots endpoint uses `/v2/stocks/snapshots` with expected query params.
- option chain endpoint uses `/v1beta1/options/snapshots/{underlying}` with expiration/type/limit query params.
- asset endpoint uses `/v2/assets/{symbol}`.
- credentials are sent as Alpaca headers.
- non-2xx responses produce a useful error message.

For CLI/tool migration tests:

- CLI `alpaca price` delegates to the service and outputs the service payload.
- AI tool `alpaca_price` delegates to the service and preserves the existing `{ ok: true, symbols, prices, warnings }` outward shape or intentionally migrates to the new shared shape.
- AI tool `alpaca_options` delegates to the service and preserves the existing `{ ok: true, underlying, contracts }` outward shape or intentionally migrates to the new shared shape.

### Old tests to delete

After boundary tests cover behavior, delete or reduce shallow tests that only validate internals now covered through the service boundary:

- Most direct tests of `normalizeLatestTrades`.
- Most direct tests of `normalizeStockSnapshots`.
- Most direct tests of `normalizeOptionChainResponse`.

Keep a small focused test for `parseOptionSymbol` if it remains a separately exported utility, or make it private and cover it through `optionChain` boundary tests.

### Test environment needs

- A fake `AlpacaMarketDataPort` for service tests.
- A fake `fetchFn` for HTTP adapter tests.
- No live credentials or network calls in unit tests.

## Implementation Recommendations

The Alpaca market-data module should own market-data behavior, not just HTTP helpers. Its responsibilities should include:

- Normalizing and validating caller inputs such as symbols, underlying tickers, feeds, and limits.
- Applying durable defaults such as stock feed and option chain limit.
- Calling an injected Alpaca port.
- Translating Alpaca wire payloads into stable domain payloads.
- Returning consistent success/error result envelopes.
- Producing warnings for partial data, especially missing requested symbols.

The module should hide:

- Alpaca endpoint URLs.
- Credential header names.
- Wire field names such as `p`, `t`, `x`, `latestTrade`, and `snapshots`.
- Option OCC symbol parsing details.
- Error conversion from thrown HTTP failures to caller-visible failures.

The module should expose:

- A small service factory: `createAlpacaMarketDataService()`.
- A production adapter factory: `createAlpacaHttpAdapter()`.
- Stable result and payload types.
- Existing normalized domain types where useful: `NormalizedPrice`, `NormalizedStockSnapshot`, `NormalizedOption`, and `NormalizedAsset`.

Migration path:

1. Add `AlpacaMarketDataPort`, `createAlpacaHttpAdapter()`, and `createAlpacaMarketDataService()` inside `packages/alpaca`.
2. Move URL construction and raw HTTP calls behind the HTTP adapter.
3. Move symbol normalization, missing-symbol handling, warning generation, defaults, and error envelopes into the service.
4. Update `apps/cli/src/commands/alpaca.ts` to create the service and call service methods instead of `getLatestPrices()` and `getOptionChain()`.
5. Update `apps/cli/src/chat/tools/alpaca.ts` to use the same service boundary. Keep zod schemas for AI-tool input validation, but remove duplicate credential/error/warning/default logic where the service now owns it.
6. Keep app-specific process behavior in the app: CLI output formatting, `process.exit`, Commander options, and environment credential loading.
7. Deprecate direct low-level exports such as `getLatestPrices()` and `getOptionChain()` after callers migrate, or keep them as thin compatibility wrappers over the service if external consumers require them.
