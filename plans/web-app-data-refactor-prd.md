## Problem Statement

The current web app works, but its architecture is heavier than the product surface justifies. The app has only two user-facing pages, yet the data path is split across multiple helper modules that each perform a mix of validation, provider access, fallback construction, and UI-oriented shaping. This makes the code harder to understand, harder to change safely, and more coupled to the current presentation than it needs to be.

The main issue is not only the number of modules. The current modules are shallow: they pass provider-specific metadata and repeated fallback objects upward instead of hiding that complexity behind a smaller, more stable app-facing contract. As a result, the web app carries data that is not product-critical, including provider provenance records and repeated source diagnostics, while also duplicating invalid, unsupported, unverified, empty, and error-state handling in several places.

The desired end state is a simpler architecture that is easy to work with, follows framework best practices for a server-rendered Next.js app, and preserves the same two-page product shape while allowing the data contract and UX to become simpler.

## Solution

Refactor the web app around a smaller stock-page data model and clearer ownership boundaries. The stock route should depend on one app-facing server contract that returns only the data the page actually needs to render. Validation, provider calls, and normalization should be pushed downward into deeper modules, ideally in shared packages when the logic is provider-facing or reusable outside the web app.

The refactor should remove unnecessary data from the UI contract, especially provider provenance arrays and other diagnostics that do not create product value. It should also reduce repeated fallback construction by centralizing status handling and section shaping so the page consumes a small, explicit view model instead of stitching together multiple helper results. The existing pages can remain in place, but their UX and API shape may change if that produces a materially simpler architecture.

## User Stories

1. As a visitor, I want the home page and stock page to keep working through the refactor, so that the app remains usable while the internals get simpler.
2. As a visitor, I want the stock page to show only data that is relevant to the product, so that the dashboard feels focused instead of diagnostic.
3. As a visitor, I want invalid, unsupported, or degraded ticker states to be clear, so that I understand what happened without seeing internal provider details.
4. As a visitor, I want the stock page to remain shareable at a stable URL, so that simplification of the internals does not break navigation.
5. As a visitor, I want the dashboard to remain readable if some data is unavailable, so that one missing field does not make the page unusable.
6. As a developer, I want one obvious server-side entry point for stock-page data, so that I can trace how the route gets its data without opening many helper files.
7. As a developer, I want the app-facing data model to contain only fields the UI actually uses, so that product changes do not require carrying dead or diagnostic payloads.
8. As a developer, I want provider-specific response shaping to live below the web app boundary when possible, so that the Next.js layer stays focused on routing, orchestration, and presentation.
9. As a developer, I want validation and stock-resolution rules to be defined once, so that invalid and unsupported states are not reconstructed differently across modules.
10. As a developer, I want partial, empty, and error states to be represented consistently, so that section components can stay simple and predictable.
11. As a developer, I want to remove repeated placeholder object construction, so that adding or deleting a section does not require editing large fallback trees.
12. As a developer, I want shared finance packages to expose deeper normalized interfaces where appropriate, so that provider migration or reuse in other surfaces is easier.
13. As a developer, I want the page components to depend on product-oriented types instead of provider-oriented types, so that the UI can evolve without leaking transport details.
14. As a developer, I want to change the stock-page UX shape if that simplifies the architecture, so that the code is not forced to preserve accidental complexity.
15. As a developer, I want the refactor to preserve deterministic behavior under missing credentials and provider failures, so that a simpler architecture does not lose robustness.
16. As a developer, I want the resulting modules to be deeper and easier to test in isolation, so that behavior can be verified without rendering the entire route.
17. As a developer, I want tests to focus on externally visible data contracts and route outcomes, so that the refactor can proceed without locking in incidental implementation details.
18. As a developer, I want the web app to follow Next.js server-component best practices, so that data loading happens close to the route boundary with less glue code.

## Implementation Decisions

- The two existing routes remain the product surface: a public search entry page and a canonical ticker page.
- The stock page should load through one app-facing server contract that owns the full route payload for a ticker request.
- The app-facing contract should return only fields that are directly rendered or required for clear user-facing state handling.
- Provider provenance arrays should be removed from the web app contract entirely.
- Provider diagnostics should be reduced to the minimum product-relevant surface. If the UI still needs freshness or source labeling, that metadata should be aggregated once per section rather than repeated on every metric.
- The web app should not construct large empty placeholder sections for invalid or unsupported tickers. Non-ready ticker states should be represented directly and rendered intentionally.
- Validation, ticker normalization, and stock-resolution rules should be centralized so both search and stock-page flows share one definition of validity and coverage handling.
- Quote, fundamentals, and cash-flow shaping should be reviewed for logic that belongs in shared data packages rather than in web-only helpers.
- Shared packages should expose normalized provider-facing functions when doing so removes web-specific translation code and creates a cleaner reusable interface.
- The web layer should prefer composition of a few deep modules over many narrow helpers that each own a partial slice of fetch, transform, and fallback behavior.
- The stock page UI may be simplified so that it no longer requires diagnostic metadata such as endpoint names, feed names, reference-point copy, or repeated retrieval metadata if those details do not materially improve the product.
- Section-level status handling should be normalized into a small and consistent contract. The refactor may reduce or rename statuses if a simpler model serves the page better.
- The stock-page route should continue to render server-side and remain responsible for canonical ticker normalization and redirect behavior.
- The refactor should preserve clear degraded behavior for missing credentials and provider failures, but that behavior should be expressed through fewer, more intentional contracts.
- The architecture should make it easy to add or remove a section without reworking unrelated modules or duplicating fallback trees.
- The result should favor product-oriented naming and interfaces over provider-oriented naming.

## Testing Decisions

- Good tests should validate externally visible behavior and stable normalized contracts, not internal helper structure.
- The highest-value tests should target the new stock-page data contract, centralized ticker-resolution behavior, and any shared normalization modules extracted during the refactor.
- Route-level smoke tests should verify canonical redirects, valid ticker rendering, and intentional invalid or degraded states.
- If data shaping moves into shared packages, those shared modules should carry deterministic fixture-based tests so provider mapping stays out of page tests.
- Tests should verify that removed fields such as provenance are no longer required by the web layer.
- Tests should verify that non-ready ticker states do not trigger unnecessary downstream data assembly.
- Existing summary-module tests can be deleted, rewritten, or consolidated if the refactor replaces those module boundaries.
- The quality gate for the refactor remains linting, type-checking, and a relevant web smoke run, with unit tests added around the new deep modules rather than preserving every old helper-level test.

## Out of Scope

This PRD does not add new product pages, account systems, watchlists, trading features, non-U.S. securities support, or AI-generated analysis.

This PRD does not require preserving the current exact section wording, status taxonomy, or provider-diagnostic UI if simpler alternatives support the same product goal.

This PRD does not require building a generic data framework for every future surface in the monorepo. Shared-package extraction should happen only where it creates a clear deeper boundary and removes real duplication from the web app.

## Further Notes

- Current UI usage suggests that provider provenance arrays are entirely unused and can be removed without product loss.
- Current UI usage also suggests repeated provider metadata may be overexposed. The dashboard currently renders source, endpoint, feed, reference-point, retrieval, and as-of details in multiple places; this should be challenged rather than preserved by default.
- The biggest architectural smell is that the web app currently owns too much fallback construction. A cleaner design would let the page render a small number of intentional states from one route-level contract.
- The refactor should aim for fewer modules with stronger interfaces, not merely renaming or relocating the current helpers.
