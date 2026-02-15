# cli

Finny is a Bun-native finance-focused CLI app.

## Requirements

- `AI_GATEWAY_API_KEY` must be set for `chat`.

## Commands

- `bun run dev`
- `bun run build`
- `bun run check-types`
- `bun run lint`

## Usage

From repo root:

- `bun run cli` (no args prints "finny is ready")
- `bun run cli --help`
- `bun run cli chat`
- `bun run cli chat --verbose`
- `bun run cli chat --smoke`

From `apps/cli`:

- `bun run src/index.ts`
- `bun run src/index.ts --help`
- `bun run src/index.ts --version`
- `bun run src/index.ts chat`
- `bun run src/index.ts bad-command` (fails with strict parse error)

After linking/installing the package bin:

- `cli --help`
- `cli chat`
- `cli --badflag` (fails with strict parse error)

## Chat

Start an interactive chat session:

From repo root (preserves stdin/TTY for REPL input):

- `bun run cli chat`

From `apps/cli`:

- `bun run src/index.ts chat`
- `bun run src/index.ts chat --verbose`
- `bun run src/index.ts chat --smoke`
- `cli chat`
- `cli chat --verbose`
- `cli chat --smoke`

Quick validation (real one-turn model ping):

- `bun run cli chat --smoke`

`--smoke` performs a real network call to the configured model and consumes
tokens. It exits immediately with pass/fail output.

REPL commands:

- `/help` Show chat commands
- `/status` Show turn, message, and verbosity state
- `/verbose on|off` Toggle step and tool traces while running
- `/undo` Remove the most recent completed turn (multi-level)
- `/retry` Retry the last input
- `/clear` Clear in-memory conversation history
- `/exit` Exit chat
- `/quit` Exit chat

By default, chat runs in a clean output mode. Use `--verbose` or `/verbose on`
to show step and tool traces.

## Parsing behavior

- `cli` with no arguments prints `finny is ready`.
- Unknown commands/options fail with a non-zero exit and help output.
