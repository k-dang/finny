# Repository Guidelines

## Project Structure & Module Organization

This repository is a Bun-powered Turborepo.

- `apps/web`: Next.js App Router frontend (`app/`, `public/`).
- `apps/cli`: Bun-native CLI entrypoint at `src/index.ts`.
- `packages/eslint-config`: Shared ESLint presets.
- `packages/typescript-config`: Shared `tsconfig` bases.
- Root config: `turbo.json`, `package.json`, `bun.lock`.

Keep app-specific code inside its app folder; move reusable UI or config into `packages/`.

## Build, Test, and Development Commands

Run commands from the repo root unless noted.

- `bun install`: Install workspace dependencies.
- `bun run dev`: Start all workspace `dev` tasks through Turbo.
- `bun run build`: Build all apps/packages (`.next/`, `dist/`).
- `bun run lint`: Run ESLint across workspaces.
- `bun run check-types`: Run TypeScript checks across workspaces.
- `bun run format`: Format `ts`, `tsx`, and `md` via Prettier.
- `bun run web`: Start only the web app.
- `bun run cli`: Run the CLI app. For interactive chat (`bun run cli chat`), use this root command so stdin/TTY is preserved; avoid turbo-based wrappers for REPL input.

## Coding Style & Naming Conventions

- React components: `PascalCase`; hooks/functions/variables: `camelCase`.
- File naming: prefer descriptive names.

## Testing Guidelines

There is no dedicated test framework configured yet. Minimum quality gate for every change:

1. `bun run lint`
2. `bun run check-types`
3. Relevant smoke run (`bun run dev --filter=web` or `bun run dev --filter=cli`).

When adding tests, colocate with source as `*.test.ts`/`*.test.tsx` and wire a workspace `test` script.

<!-- opensrc:start -->

## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc pypi:<package>      # Python package (e.g., npx opensrc pypi:requests)
npx opensrc crates:<package>    # Rust crate (e.g., npx opensrc crates:serde)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```

<!-- opensrc:end -->