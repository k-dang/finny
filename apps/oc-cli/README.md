# oc-cli

Standalone Bun-native CLI app in the Finny Turborepo.

## Requirements

- `opencode` must be available on `PATH` (for example via `npm i -g opencode-ai`).
- Configure at least one model/provider in OpenCode before using `chat`.
- `ALPACA_API_KEY` and `ALPACA_API_SECRET` must be set to use Alpaca custom tools.
- IBKR custom tools require the IBKR Client Portal Gateway running locally (default `https://localhost:5000`).

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
- `bun run oc-cli tools`
- `bun run oc-cli tools --expect read`

From `apps/oc-cli`:

- `bun run src/index.ts`
- `bun run src/index.ts --help`
- `bun run src/index.ts --version`
- `bun run src/index.ts start`
- `bun run src/index.ts chat`
- `bun run src/index.ts chat --verbose`
- `bun run src/index.ts chat --smoke`
- `bun run src/index.ts tools`
- `bun run src/index.ts tools --expect read`
- `bun run src/index.ts tools --expect alpaca_price --expect alpaca_options`
- `bun run src/index.ts tools --expect polymarket_active_events --expect polymarket_markets`

After linking/installing package bin:

- `oc-cli --help`
- `oc-cli --version`
- `oc-cli start`
- `oc-cli chat`
- `oc-cli chat --verbose`
- `oc-cli chat --smoke`
- `oc-cli tools`
- `oc-cli tools --expect read`
- `oc-cli tools --expect alpaca_price --expect alpaca_options`
- `oc-cli tools --expect polymarket_active_events --expect polymarket_markets`

## Chat

Start an interactive OpenCode SDK-backed session:

- `bun run oc-cli chat`
- `bun run src/index.ts chat`
- `oc-cli chat`

Behavior:

- Assistant output streams incrementally as events arrive (instead of waiting for a full turn response).
- During a response, press Ctrl+C once to interrupt the current turn; press Ctrl+C again at prompt to exit.

Quick validation (real one-turn model ping):

- `bun run oc-cli chat --smoke`

REPL commands:

- `/help` Show chat commands
- `/status` Show current chat state
- `/verbose on|off` Toggle compact stream diagnostics
- `/clear` Start a fresh session
- `/exit` Exit chat
- `/quit` Exit chat

## Tools

Quickly verify OpenCode tool registration:

- `bun run oc-cli tools`
- `bun run oc-cli tools --expect my_custom_tool`
- `bun run oc-cli tools --provider anthropic --model claude-sonnet-4-5`

Behavior:

- Lists all registered tool IDs from the running OpenCode runtime.
- Exits with code `1` if any `--expect` tool ID is missing.
- Also checks tool schema resolution using `tool.list` (provider/model-specific).

`oc-cli` includes project-local custom tools in `apps/oc-cli/.opencode/tools`:

- `alpaca_price` for latest stock prices
- `alpaca_options` for option chain snapshots
- `ibkr_list_accounts` to list available IBKR account IDs
- `ibkr_portfolio_snapshot` for read-only IBKR account summary and optional positions
- `polymarket_active_events` for active event discovery
- `polymarket_markets` for market-level snapshots and filters

## Parsing behavior

- `oc-cli` with no arguments prints `oc-cli is ready`.
- Unknown commands/options fail with a non-zero exit and help output.
