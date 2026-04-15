# Plan: Web App Data Refactor

> Source PRD: [web-app-data-refactor-prd.md](./web-app-data-refactor-prd.md)

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: Keep the current two-route product surface: a public search entry page and a canonical stock page at `/stocks/[ticker]`.
- **Rendering model**: The stock page remains server-rendered and continues to own ticker normalization and canonical redirect behavior at the route boundary.
- **Composition boundary**: The stock page should consume one app-facing server contract for its full route payload rather than orchestrating several shallow helper modules.
- **Key models**: `TickerResolution`, `StockPageData`, and a small set of product-oriented section models for any quote, fundamentals, or cash-flow data that remains visible.
- **State model**: Non-ready ticker states should be represented directly rather than by manufacturing large empty dashboard sections.
- **Provider boundaries**: Provider-specific fetching and normalization should move down into shared packages when doing so creates a deeper reusable boundary and removes web-only translation code.
- **Data contract**: The web layer should carry only product-relevant fields; provider provenance arrays are out of the contract, and provider diagnostics should be aggregated only where they materially support the product.
- **Testing model**: Tests should focus on route outcomes and stable normalized contracts rather than preserving the current helper/file structure.

---

## Phase 1: Route Contract And State Model

**User stories**: 1, 3, 4, 6, 7, 9, 10, 13, 18

### What to build

Define the new stock-page contract and centralize ticker-resolution behavior behind it. This slice should replace the current pattern where multiple modules independently validate input or construct fallback states. The result should be that a ticker request flows through one obvious server-side entry point and returns a compact route payload with intentional states for valid, invalid, unsupported, and degraded scenarios.

### Acceptance criteria

- [ ] The stock-page route depends on one app-facing data contract for a ticker request.
- [ ] Ticker normalization, validation, and coverage handling are defined once and shared consistently across the search flow and stock page.
- [ ] Invalid, unsupported, and degraded ticker states are represented directly rather than by building placeholder section payloads.
- [ ] The canonical stock URL behavior remains intact.

---

## Phase 2: Quote Slice Simplification

**User stories**: 2, 5, 7, 8, 10, 13, 14, 15

### What to build

Refactor the quote path so the stock page receives a smaller quote section contract with only product-relevant fields. The slice should preserve the user-visible quote experience where it still adds value, while removing or aggregating provider diagnostics that exist primarily because of the current helper architecture. The resulting quote section should remain robust under missing credentials or provider failure without leaking unnecessary transport details into the UI.

### Acceptance criteria

- [ ] The quote section contract contains only fields the UI intentionally renders.
- [ ] Quote-related provider diagnostics are removed or aggregated to a minimal product-facing surface.
- [ ] Quote failures or missing credentials remain localized and deterministic.
- [ ] The stock page continues to render a useful quote section for supported tickers through the new route contract.

---

## Phase 3: Fundamentals And Cash Flow Contract Cleanup

**User stories**: 2, 5, 7, 8, 10, 11, 12, 13, 15, 16

### What to build

Reshape the fundamentals and cash-flow paths into smaller product-oriented contracts and remove repeated placeholder assembly. This slice should challenge whether each field is needed, strip out unused provenance data, and push reusable provider-facing normalization into shared packages when that creates a cleaner boundary. The result should be fewer deeper modules, easier section removal or expansion, and a stock-page contract that is not anchored to provider response details.

### Acceptance criteria

- [ ] Fundamentals and cash-flow section models are reduced to the fields the product actually needs.
- [ ] Unused provenance data is removed from the web contract.
- [ ] Repeated fallback or placeholder construction for fundamentals and cash flow is eliminated or centralized.
- [ ] Any extracted shared normalization boundary is reusable and no longer web-specific in shape.

---

## Phase 4: Stock Page UI Simplification

**User stories**: 1, 2, 3, 5, 10, 13, 14, 18

### What to build

Update the stock-page UI to consume the new route contract and present a cleaner product surface. This phase should keep the same pages while simplifying copy, removing overly diagnostic metadata, and making the page reflect the new intentional state model. The goal is to ensure the UI is driven by product-oriented types instead of by the structure of current helper outputs.

### Acceptance criteria

- [ ] The stock page components consume the new product-oriented route contract.
- [ ] Diagnostic metadata that no longer serves the product is removed from the rendered UI.
- [ ] Valid, invalid, unsupported, and degraded experiences remain clear after the contract change.
- [ ] The page remains usable and shareable with the same route structure as before.

---

## Phase 5: Test And Boundary Hardening

**User stories**: 15, 16, 17, 18

### What to build

Harden the refactor by rewriting coverage around the new deep boundaries and verifying the route behavior end to end. This phase should remove obsolete tests that only protect the old helper layout, add deterministic coverage for the new contract and ticker-resolution behavior, and confirm the refactor still satisfies the repo quality gate. The completed result should be easier to extend because the tests now protect product behavior and stable interfaces rather than incidental helper structure.

### Acceptance criteria

- [ ] Deterministic tests cover the new stock-page contract and centralized ticker-resolution behavior.
- [ ] Route-level smoke coverage verifies canonical redirect behavior and intentional valid and non-ready states.
- [ ] Obsolete helper-level tests are removed, rewritten, or consolidated to match the new architecture.
- [ ] The refactor passes linting, type-checking, and a relevant web smoke run.
