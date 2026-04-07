# Plan: Stock Analysis Web App

> Source PRD: [stock-analysis-web-app-prd.md](./stock-analysis-web-app-prd.md)

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: Public anonymous entry at `/` with a ticker search flow that navigates to a canonical ticker route at `/stocks/[ticker]`.
- **Supported universe**: U.S.-listed equities only, with ticker input normalized to uppercase canonical symbols before routing or fetches.
- **Composition boundary**: The web app should expose a dedicated stock-dashboard composition module that aggregates quote and fundamentals data into a normalized view model for the route.
- **Provider boundaries**: Market data should explore `@repo/alpaca` first, while fundamentals should be sourced through `@repo/finance-core` and remain provider-agnostic.
- **Key models**: `TickerInput`, `TickerResolution`, `QuoteSummary`, `FundamentalsSummary`, `CashFlowSummary`, and `StockDashboardViewModel`.
- **Freshness and provenance**: Every metric group should preserve retrieval timestamps and provider provenance from shared packages into the web-facing view model.
- **Failure model**: Each dashboard section must support success, partial, empty, and error states independently so one provider failure does not blank the full page.
- **Rendering model**: Initial ticker-page data should be fetched server-side so the canonical stock URL renders useful first content directly.
- **Scope guardrails**: No auth, persistence, watchlists, portfolios, AI commentary, trading flows, or non-U.S. securities in v1.

---

## Phase 1: Search And Canonical Ticker Route

**User stories**: 1, 2, 3, 4, 5, 18

### What to build

Create the public entry experience and canonical stock route. A visitor lands on the home page, enters a ticker, and is taken to a stable `/stocks/[ticker]` URL after ticker normalization. Unsupported or invalid symbols should render a clear, explicit error state instead of a broken dashboard. The route should establish the dashboard shell and show company identity when it is available from the upstream data path.

### Acceptance criteria

- [ ] The web app has a public search-first landing page that navigates to a canonical ticker URL.
- [ ] Ticker input is normalized consistently and rejects invalid or unsupported symbols with a clear user-facing state.
- [ ] The ticker page renders a stable shell for valid symbols and supports bookmarking or sharing by URL.
- [ ] The page communicates that v1 coverage is limited to U.S.-listed stocks.

---

## Phase 2: Quote Summary Slice

**User stories**: 6, 7, 8, 9, 15, 16, 17, 19, 20, 21, 22, 23

### What to build

Add an end-to-end quote summary slice backed by the shared Alpaca package and normalized through the stock-dashboard composition layer. The ticker page should render current price, daily dollar change, daily percentage change, last-updated time, and source context. Daily movement must use one consistent reference point so the result is interpretable across all supported tickers. Missing credentials or quote-provider limitations should degrade into a contained quote-section state rather than failing the route.

### Acceptance criteria

- [ ] The dashboard shows current price, daily dollar change, and daily percent change for supported tickers.
- [ ] Quote freshness and source context are visible in the quote section.
- [ ] Daily change uses one documented reference point across all rendered symbols.
- [ ] Quote-provider failures or missing credentials produce a localized degraded state without blanking the page.
- [ ] The quote data path is normalized behind a stable internal contract that is testable without rendering the full route.

---

## Phase 3: Earnings And Valuation Slice

**User stories**: 10, 11, 13, 14, 15, 19, 20, 21, 23

### What to build

Extend the same ticker route with fundamentals cards for next earnings date and a valuation metric such as P/E ratio. The composition layer should source these fields through provider-agnostic fundamentals contracts so the UI does not depend on a single vendor. The slice must explicitly distinguish unavailable data from legitimate zero or empty values, while preserving provenance and graceful partial rendering when only one fundamentals field is obtainable.

### Acceptance criteria

- [ ] The dashboard shows next earnings date when available and a valuation metric when available.
- [ ] Missing fundamentals fields are labeled as unavailable rather than rendered as zero-equivalent values.
- [ ] Fundamentals provenance and freshness are preserved into the rendered section.
- [ ] A failure in one fundamentals fetch path does not remove successful quote data or other successful sections.
- [ ] The fundamentals mapping logic is isolated from presentation and can be verified with deterministic fixtures.

---

## Phase 4: Cash Flow Slice And Degraded Composition

**User stories**: 12, 13, 14, 15, 16, 17, 19, 20, 21, 23, 24

### What to build

Add a compact cash-flow section to the ticker dashboard using a normalized summary of recent operating, investing, financing, and free-cash-flow values when available. At the same time, harden the full dashboard composition contract so the route can render mixed success states across quote, earnings, valuation, and cash flow without ambiguity. The result should remain readable on desktop and mobile and should continue emphasizing factual presentation over financial modeling or generated commentary.

### Acceptance criteria

- [ ] The dashboard presents cash-flow data in a compact factual format suitable for quick inspection.
- [ ] Cash-flow output clearly differentiates unavailable data from zero values.
- [ ] The full dashboard can render partial-success combinations across sections without collapsing the page.
- [ ] The mobile and desktop layout remain usable after all v1 sections are present.
- [ ] The dashboard remains deterministic and free of AI-generated narratives or recommendations.

---

## Phase 5: Quality Gate And Release Hardening

**User stories**: 14, 16, 17, 19, 20, 21, 22, 23, 24

### What to build

Close the first release by hardening tests, operational diagnostics, and performance-oriented route behavior around the completed slices. This phase should add deterministic coverage for ticker normalization, quote normalization, fundamentals shaping, and dashboard composition; confirm the route behaves correctly for valid, invalid, and degraded states; and ensure the web app now depends on the shared finance packages intentionally rather than through page-level ad hoc fetch logic.

### Acceptance criteria

- [ ] Deterministic tests cover ticker normalization, quote mapping, fundamentals mapping, cash-flow shaping, and mixed-success composition behavior.
- [ ] The web route has smoke-level verification for valid ticker rendering, invalid ticker handling, and degraded section rendering.
- [ ] The completed app passes the repo minimum quality gate of linting, type-checking, and a relevant web smoke run.
- [ ] Shared provider packages remain the source of provider-specific logic, while the web app owns orchestration and presentation only.
- [ ] The release remains within v1 scope and excludes persistence, trading, watchlists, accounts, and advanced research features.
