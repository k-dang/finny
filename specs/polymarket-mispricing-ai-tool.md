# Polymarket Mispricing AI Tool (V1)

## Meta

- Type: Feature plan
- Effort: L
- Status: Ready for task breakdown
- Phase: DONE

## Problem Definition

Build a CLI-first AI SDK tool that surfaces potentially mispriced Polymarket markets to improve decision quality.

- User problem: Manual scanning is slow and inconsistent.
- Decision target: Identify candidate mispricings in market odds.
- Scope boundary: Insights only (no order placement or automation).

## Motivation and Outcome

Provide structured, explainable opportunity ranking so the user can make faster, higher-quality discretionary decisions.

- Success metric (primary): Decision quality improvement versus baseline picks.
- Secondary outcomes: Faster market triage and repeatable analysis workflow.

## Constraints

- Platform: CLI first (`apps/cli`).
- Fair value baseline: Market microstructure only.
- Risk posture: Informational analysis only.
- Data source: Public Polymarket APIs (no auth-required trading endpoints for v1).

## Discovery Summary

- Existing integration point for AI tools is `apps/cli/src/chat/tools/*` with registration in `apps/cli/src/chat/agent.ts`.
- Existing command pattern lives under `apps/cli/src/commands/*` and registration in `apps/cli/src/program.ts`.
- No existing Polymarket client or odds/probability module exists in the repo.
- Existing architecture favors reusable API clients in `packages/*` consumed by CLI.

## Recommended Solution

Implement a balanced v1:

1. Add a reusable read-only Polymarket client package.
2. Add a microstructure-based mispricing scoring engine.
3. Add an AI SDK chat tool (`polymarket_mispricing_scan`) that returns ranked opportunities.
4. Optionally add a direct CLI command (`polymarket scan`) mirroring the tool output.

## Solution Space and Trade-offs

### Simplest

Single chat tool with inline fetch/scoring logic.

- Pros: Fastest initial delivery.
- Cons: Harder to test/reuse; technical debt for later web support.

### Balanced (Recommended)

Shared package + scoring engine + chat tool (+ optional CLI command).

- Pros: Maintainable, testable, reusable; still pragmatic for v1.
- Cons: Slightly more upfront effort.

### Full Engineering

Streaming ingestion, persistence, backtests, portfolio-aware optimization.

- Pros: Highest long-term capability.
- Cons: Over-scoped for v1.

## Deliverables (Ordered)

1. **[x] D1: `packages/polymarket` client** (M) — depends on: -
   - Implement typed read-only methods:
     - `listMarkets(params)`
     - `getEventBySlug(slug)`
     - `getOrderbookSummary(tokenId)` (or batched equivalent)
   - Normalize external responses into internal types.

2. **[x] D2: Mispricing scoring engine** (M) — depends on: D1
   - Pure functions that output deterministic signal objects.
   - Heuristics (weighted):
     - spread quality
     - liquidity/depth quality
     - short-term momentum dislocation
     - related-market consistency checks
     - stale/low-activity penalties

3. **[x] D3: AI SDK tool integration** (M) — depends on: D2
   - Add `apps/cli/src/chat/tools/polymarket.ts`.
   - Tool: `polymarket_mispricing_scan`.
   - Inputs: `query`, `limit`, `minVolume`, `maxSpreadBps`, `timeHorizonHours`.
   - Output: ranked opportunities + concise rationale + risk flags.
   - Register in `apps/cli/src/chat/agent.ts` and update instructions.

4. **[x] D4: Optional direct CLI command** (S/M) — depends on: D2
   - Add `apps/cli/src/commands/polymarket.ts`.
   - Subcommand: `polymarket scan`.
   - Output: machine-readable JSON matching tool schema.

5. **[x] D5: Docs and validation** (S) — depends on: D3 (and D4 if included)
   - Update `apps/cli/README.md` with usage and scope disclaimer.
   - Run quality gates:
     - `bun run lint`
     - `bun run check-types`
     - `bun run cli chat --smoke`
     - `bun run src/index.ts --help` (from `apps/cli`)

## Data Contracts

### `PolymarketMarket`

- `id: string`
- `slug: string`
- `question: string`
- `eventId: string`
- `outcomes: string[]`
- `active: boolean`
- `endDate: string | null`
- `volume24h: number | null`
- `liquidity: number | null`

### `OrderbookSnapshot`

- `tokenId: string`
- `bestBid: number | null`
- `bestAsk: number | null`
- `midpoint: number | null`
- `spreadBps: number | null`
- `timestamp: string`

### `MispricingSignal`

- `marketId: string`
- `marketSlug: string`
- `side: "YES" | "NO"`
- `marketProb: number`
- `fairProbProxy: number`
- `edgePct: number`
- `mispricingScore: number`
- `confidence: "low" | "medium" | "high"`
- `rationale: string[]`
- `riskFlags: string[]`

## Acceptance Criteria

1. Tool returns at least one ranked signal for valid query paths using public endpoints.
2. Each signal includes score, edge estimate, confidence, rationale, and risk flags.
3. Failures return structured errors (`ok: false`) with actionable messages.
4. Agent reliably invokes the tool on Polymarket opportunity requests.
5. README documents usage and educational-analysis disclaimer.
6. Lint and typecheck pass.

## Risks and Mitigations

1. **API drift / schema changes**
   - Mitigation: typed adapters, response guards, graceful fallbacks.

2. **False positives in thin markets**
   - Mitigation: strict spread/liquidity penalties and confidence downgrades.

3. **User over-trust in score output**
   - Mitigation: mandatory caveats and explicit risk flags in every response.

## Non-Goals (V1)

- No order placement or cancellation.
- No fully automated trading.
- No external fair-value datasets (polls/news/bookmakers).
- No live websocket streaming/persistence/backtesting framework.

## Dependency Order

- D1 blocks D2.
- D2 blocks D3 and D4.
- D3 (and D4 if included) blocks D5.

## Open Questions

- None for v1.
