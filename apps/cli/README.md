# cli

Bun-native CLI app.

## Requirements

- `AI_GATEWAY_API_KEY` must be set for `chat`.

## Commands

- `bun run dev`
- `bun run build`
- `bun run check-types`
- `bun run lint`

## Usage

From repo root:

- `bun run cli` (no args prints "cli is ready")
- `bun run cli --help`
- `bun run cli chat`

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
- `cli chat`

REPL commands:

- `/help` Show chat commands
- `/clear` Clear in-memory conversation history
- `/exit` Exit chat
- `/quit` Exit chat

## Parsing behavior

- `cli` with no arguments prints `cli is ready`.
- Unknown commands/options fail with a non-zero exit and help output.
