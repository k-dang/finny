## Problem Statement

The current monorepo has a starter web app and shared finance packages, but it does not yet provide a usable stock analysis experience. The goal for the first version is to turn the web app into a public, single-ticker research page for U.S.-listed stocks that lets a user search for a ticker and quickly understand core market and fundamentals data without needing to use a brokerage terminal, a screener, or an AI assistant.

For this first release, the user needs a deterministic dashboard that surfaces factual metrics clearly. At minimum, the page should support searching for a U.S. ticker and showing the current price, daily change, next earnings date when available, a valuation metric such as P/E ratio, and cash flow data in a way that is readable and trustworthy.

## Solution

Build a public stock analysis dashboard in the web app that centers on a single U.S. ticker lookup flow. A user lands on the page, enters a ticker, and is taken to a ticker-specific dashboard that assembles market data and fundamentals from shared provider modules. The experience should emphasize clarity, provenance, and graceful degradation when some providers or fields are unavailable.

The first version should use the existing shared finance packages as the base of the architecture. Alpaca should be explored first for quote and other market-data capabilities, while the fundamentals layer should remain provider-agnostic so the app can use existing fundamentals sources already present in the repo and add or swap providers later if Alpaca does not cover all required fields. The UI should remain factual and non-AI-driven, showing normalized metrics and source freshness rather than generated commentary.

## User Stories

1. As a visitor, I want to open the web app without signing in, so that I can evaluate a stock immediately.
2. As a visitor, I want to search by ticker symbol, so that I can jump directly to a company I care about.
3. As a visitor, I want invalid or unsupported tickers to produce a clear error state, so that I know whether the issue is my input or missing coverage.
4. As a visitor, I want the app to focus on U.S.-listed stocks only, so that the results are consistent with the supported data universe.
5. As a visitor, I want to see the company name alongside the ticker when available, so that I can confirm I opened the right security.
6. As a visitor, I want to see the current price, so that I can understand where the stock is trading now.
7. As a visitor, I want to see the daily change in both dollars and percent, so that I can quickly gauge today’s movement.
8. As a visitor, I want daily change to be based on a consistent reference point, so that the number is interpretable and not misleading.
9. As a visitor, I want the dashboard to show when the displayed market data was last updated, so that I can judge freshness.
10. As a visitor, I want to see the next earnings date when it is available, so that I know whether a near-term catalyst is approaching.
11. As a visitor, I want to see a valuation metric such as price-to-earnings ratio, so that I can quickly assess valuation at a glance.
12. As a visitor, I want to see cash flow data in a compact but intelligible format, so that I can understand whether the business is generating or consuming cash.
13. As a visitor, I want the dashboard to distinguish between unavailable data and zero values, so that I do not misread missing information.
14. As a visitor, I want the page to remain usable if one provider fails but others succeed, so that a partial outage does not blank the full dashboard.
15. As a visitor, I want each metric group to indicate its source or retrieval context, so that I can trust what I am seeing.
16. As a visitor, I want the dashboard to load quickly enough for casual research, so that the app feels responsive.
17. As a visitor, I want the layout to work on both desktop and mobile screens, so that I can use it from either device.
18. As a visitor, I want the ticker page to have a stable URL, so that I can bookmark or share a specific stock view.
19. As a developer, I want provider integrations normalized behind stable internal interfaces, so that I can change data vendors without rewriting the UI.
20. As a developer, I want quote and fundamentals fetching to be isolated from presentation logic, so that the behavior can be tested without rendering the full app.
21. As a developer, I want the dashboard composition layer to tolerate missing credentials or provider limitations, so that development and deployment failures are easier to diagnose.
22. As a developer, I want to reuse existing shared Alpaca and finance-core packages where possible, so that new web-specific code stays thin.
23. As a developer, I want the system to record or expose provenance metadata for returned fields, so that future auditability and debugging remain possible.
24. As a developer, I want the first release to avoid account systems, watchlists, and AI-generated summaries, so that delivery focuses on a crisp, testable vertical slice.

## Implementation Decisions

- The product scope is a public, anonymous, single-ticker stock analysis page for U.S. equities only.
- The initial navigation model should support a primary search entry point and a canonical ticker-specific route so each stock dashboard has a direct URL.
- The first release should remain deterministic and metric-based. It should not generate narrative insights, recommendations, or AI summaries.
- The dashboard should be organized into a small set of factual sections such as quote summary, upcoming earnings, valuation, and cash flow.
- The market-data layer should explore Alpaca first for current pricing and daily movement because the repo already contains an Alpaca package and environment wiring for Alpaca credentials.
- The fundamentals layer should not assume Alpaca is the only provider. The architecture should support pulling fundamentals from whichever provider can reliably supply earnings dates, ratios, and statements.
- Existing shared finance packages indicate that multiple provider families are already present internally, including market-data access, fundamentals access, and SEC filing access. The web app should build on these packages rather than embedding direct third-party fetch logic in page components.
- A dedicated stock-dashboard composition module should aggregate quote data and fundamentals into a normalized web-facing view model. This should be the primary deep module for the feature because it hides provider-specific response shapes and fallback behavior behind a compact interface.
- A ticker-validation and normalization module should enforce U.S.-stock assumptions, canonicalize input, and define how unsupported symbols are rejected.
- The quote model should include current price, daily absolute change, daily percentage change, retrieval timestamp, and any source metadata needed for transparency.
- The fundamentals model should include next earnings date when available, a P/E value when available, and a compact cash flow representation suitable for a v1 dashboard.
- Cash flow should be presented in a compact factual form rather than as a full financial-modeling tool. The first version can limit itself to a small number of recent annual or quarterly operating, investing, financing, and free-cash-flow values if those are available from the provider layer.
- The app should make missing-data behavior explicit. Each dashboard section should support success, partial, empty, and error states without collapsing the entire page.
- Provider provenance should be preserved through the shared-data and composition layers so the UI can expose freshness and source context where appropriate.
- The app should use server-side data fetching for the initial dashboard payload so the first contentful view can be rendered directly for a ticker route and shared by URL.
- Search interaction should remain simple in v1: enter a ticker, submit, navigate to the ticker dashboard.
- The UI should prioritize readability over density. Numbers should be formatted consistently, signs and colors should communicate daily movement, and financial tables or cards should avoid unnecessary jargon.
- Because the existing repository already contains a reusable fundamentals package and environment variables for FMP, the PRD assumes v1 may use non-Alpaca fundamentals sources where Alpaca does not expose required fields. If Alpaca later proves sufficient for any of those fields, the provider composition layer should allow substitution without a UI rewrite.
- The app should not include persistence features in v1. No watchlist, saved history, portfolios, alerts, or user-specific state are required beyond transient search/navigation state.
- The app should not include trading features, account connectivity, or brokerage workflows in v1.

## Testing Decisions

- Good tests should verify externally visible behavior and normalized data contracts rather than provider implementation details or CSS structure.
- The highest-value tests should target deep modules that normalize and compose provider responses into the dashboard view model.
- The ticker-validation and normalization module should be tested for supported inputs, unsupported symbols, casing normalization, and invalid search states.
- The quote normalization layer should be tested for correct current-price mapping, daily-change calculations, timestamp handling, and missing-field behavior.
- The fundamentals normalization layer should be tested for earnings-date extraction, valuation-ratio extraction, and compact cash-flow shaping from provider payloads.
- The stock-dashboard composition module should be tested for partial-success scenarios, provider failures, explicit missing data, and provenance propagation.
- The public route behavior should have at least smoke-level coverage for valid ticker rendering, invalid ticker handling, and degraded rendering when some sections fail.
- Existing prior art in the repository suggests package-level Bun tests focused on pure behavior and result helpers. New tests should follow that style for shared modules and add minimal web-level smoke coverage where necessary.
- Tests should avoid live third-party network calls. Provider behavior should be validated via mocked or fixture-based payloads so test results are deterministic.
- Because there is not yet a mature end-to-end test setup in the repository, v1 should rely on package-level unit tests, web-level smoke validation, linting, and type-checking as the minimum quality gate.

## Out of Scope

This PRD does not cover multi-ticker comparison, watchlists, saved searches, portfolios, user accounts, alerts, trading, options analytics, ETF support, non-U.S. securities, AI-generated commentary, chat, recommendation engines, social features, or a full-featured financial terminal experience.

This PRD also does not require advanced charting, historical price exploration, analyst consensus summaries, news feeds, insider-activity visualizations, or deep SEC-document exploration in the first release, even if some underlying provider capabilities already exist in shared packages.

## Further Notes

- The current repository state suggests a strong architectural path: keep provider-specific code in shared finance packages and keep the web app focused on orchestration and presentation.
- The first implementation should explicitly verify what Alpaca can provide for this use case before adding or expanding other provider usage, but the UI contract should not depend on Alpaca alone for fundamentals.
- The first release should prefer a narrow, polished vertical slice over broad financial coverage. A clean single-ticker dashboard with dependable metrics is more valuable than a larger but inconsistent feature set.
- Source freshness and metric provenance should be treated as product features, not only debugging details, because they improve user trust in a finance application.
