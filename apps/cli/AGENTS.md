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
- Keep command output machine-readable JSON by default for data commands; gate diagnostics behind explicit flags (for example `--trace`).
- In TTY mode, keep REPL role prompts visually distinct (`user>` vs `assistant>`); keep non-TTY output plain text.
- When changing behavior, update `README.md` and this file's behavior contract in the same change.

## Validation Checklist

For every CLI change, run:

1. `bun run lint`
2. `bun run check-types`
3. `bun run src/index.ts chat --smoke` (real one-turn model ping)
4. `bun run src/index.ts --help`
