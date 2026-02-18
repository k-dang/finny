# oc-cli

Standalone Bun-native CLI app in the Finny Turborepo.

## Commands

- `bun run dev`
- `bun run build`
- `bun run check-types`
- `bun run lint`

## Usage

From repo root:

- `bun run oc-cli`
- `bun run oc-cli --help`
- `bun run oc-cli --version`
- `bun run oc-cli start`

From `apps/oc-cli`:

- `bun run src/index.ts`
- `bun run src/index.ts --help`
- `bun run src/index.ts --version`
- `bun run src/index.ts start`

After linking/installing package bin:

- `oc-cli --help`
- `oc-cli --version`
- `oc-cli start`

## Parsing behavior

- `oc-cli` with no arguments prints `oc-cli is ready`.
- Unknown commands/options fail with a non-zero exit and help output.
