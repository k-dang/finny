# CLI Workspace Guidelines

## Scope

These instructions apply to `apps/cli` only. For monorepo-wide rules, use the root `AGENTS.md`.

## Project Structure

- `src/index.ts`: CLI entrypoint and parse bootstrap.
- `src/program.ts`: root program configuration.
- `src/commands/`: subcommand registration.
- `src/chat/`: interactive chat runtime, agent, and helpers.
- `src/chat/tools/`: individual tool definitions.
- `package.json`: scripts, bin mapping, and dependency declarations.

Keep CLI logic inside `apps/cli`. Do not add web-app-specific conventions or references here.

## Build, Lint, and Typecheck

Run from `apps/cli`:

- `bun run dev`: run the CLI entrypoint directly.
- `bun run build`: compile `src/index.ts` to `dist/`.
- `bun run check-types`: run TypeScript checks with no emit.
- `bun run lint`: run ESLint with zero warnings allowed.

Optional from repo root:

- `bun run dev --filter=cli`
- `bun run build --filter=cli`
- `bun run check-types --filter=cli`
- `bun run lint --filter=cli`

## Coding Conventions

- Use TypeScript with ESM modules and Bun runtime compatibility.
- Use `commander` for command routing, options, help/version output, and parse errors.
- Keep `src/index.ts` minimal; place command behavior in `src/commands` and runtime logic in focused modules.
- Keep `chat` output clean by default; reserve step/tool telemetry for explicit verbose mode (`--verbose` or `/verbose on`).
- In TTY mode, keep REPL role prompts visually distinct (`user>` vs `assistant>`); keep non-TTY output plain text.
- When changing behavior, update `README.md` and this file's behavior contract in the same change.

## Behavior Contract

- The CLI is finance-focused and optimizes for stock/options decision support.
- Running `cli` with no arguments prints `finny is ready`.
- `chat` remains analysis-oriented by default and does not execute broker orders.
- `chat` may run local shell commands through the bash tool when needed.
- `chat` may fetch read-only Alpaca market data via `alpaca_price` and `alpaca_options`.
- `alpaca` provides read-only Alpaca market data checks for quick local testing.

## Validation Checklist

For every CLI change, run:

1. `bun run lint`
2. `bun run check-types`
3. `bun run src/index.ts chat --smoke` (real one-turn model ping)
4. `bun run src/index.ts --help`
5. `bun run src/index.ts alpaca price AAPL --minimal` (requires Alpaca credentials)
