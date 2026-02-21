# oc-cli

Standalone Bun-native CLI app in the Finny Turborepo.

## Requirements

- `opencode` must be available on `PATH` (for example via `npm i -g opencode-ai`).
- Configure at least one model/provider in OpenCode before using `chat`.

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
- `bun run oc-cli chat`
- `bun run oc-cli chat --verbose`
- `bun run oc-cli chat --smoke`

From `apps/oc-cli`:

- `bun run src/index.ts`
- `bun run src/index.ts --help`
- `bun run src/index.ts --version`
- `bun run src/index.ts start`
- `bun run src/index.ts chat`
- `bun run src/index.ts chat --verbose`
- `bun run src/index.ts chat --smoke`

After linking/installing package bin:

- `oc-cli --help`
- `oc-cli --version`
- `oc-cli start`
- `oc-cli chat`
- `oc-cli chat --verbose`
- `oc-cli chat --smoke`

## Chat

Start an interactive OpenCode SDK-backed session:

- `bun run oc-cli chat`
- `bun run src/index.ts chat`
- `oc-cli chat`

Quick validation (real one-turn model ping):

- `bun run oc-cli chat --smoke`

REPL commands:

- `/help` Show chat commands
- `/status` Show current chat state
- `/verbose on|off` Toggle extra request diagnostics
- `/undo` Remove the most recent completed turn
- `/retry` Retry the last input
- `/clear` Clear in-memory conversation history
- `/exit` Exit chat
- `/quit` Exit chat

## Parsing behavior

- `oc-cli` with no arguments prints `oc-cli is ready`.
- Unknown commands/options fail with a non-zero exit and help output.
