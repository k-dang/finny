# OC-CLI Workspace Guidelines

## Scope

These instructions apply to `apps/oc-cli` only. For monorepo-wide rules, use the root `AGENTS.md`.

## Project Structure

- `src/index.ts`: CLI entrypoint and parse bootstrap.
- `src/program.ts`: root command registration.
- `src/commands/`: subcommand handlers (`start`, `chat`, `tools`).
- `src/chat/`: OpenCode runtime session and REPL flow.
- `README.md`: local usage and behavior contract.

Keep `oc-cli` behavior isolated to this package. Do not add web app or unrelated workspace conventions here.

## OpenCode Custom Tools

When adding custom OpenCode tools for `oc-cli`, place them in one of these OpenCode discovery locations:

- Project-local: `.opencode/tools/*.ts` (preferred for this repo)
- Global user config: `~/.config/opencode/tools/*.ts`

For `apps/oc-cli`, prefer `apps/oc-cli/.opencode/tools/*.ts` so tools are scoped to this workspace.

Notes:

- Both `.opencode/tools` and legacy `.opencode/tool` are supported by OpenCode.
- Tool files are loaded by the OpenCode runtime started by SDK calls in `oc-cli`.
- Use `bun run src/index.ts tools --expect <tool_id>` to verify registration.

## Build, Lint, and Typecheck

Run from `apps/oc-cli`:

- `bun run dev`: run the CLI entrypoint directly.
- `bun run build`: compile `src/index.ts` to `dist/`.
- `bun run check-types`: run TypeScript checks with no emit.
- `bun run lint`: run ESLint with zero warnings allowed.

Optional from repo root:

- `bun run dev --filter=oc-cli`
- `bun run build --filter=oc-cli`
- `bun run check-types --filter=oc-cli`
- `bun run lint --filter=oc-cli`

## Coding Conventions

- Use TypeScript ESM and Bun runtime compatibility.
- Use `commander` for command definitions, option parsing, and exit behavior.
- Keep `src/index.ts` minimal; keep behavior in `src/commands` and reusable runtime logic in `src/chat`.
- Keep output concise and deterministic for smoke/verification commands (`chat --smoke`, `tools`).
- When command behavior changes, update `README.md` and this file in the same change.

## Validation Checklist

For `oc-cli` behavior changes, run:

1. `bun run lint`
2. `bun run check-types`
3. `bun run src/index.ts tools --expect read`
4. `bun run src/index.ts --help`
