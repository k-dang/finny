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
- `bun run cli`: Run the CLI app.

## Coding Style & Naming Conventions
- React components: `PascalCase`; hooks/functions/variables: `camelCase`.
- File naming: prefer descriptive names.

## Testing Guidelines
There is no dedicated test framework configured yet. Minimum quality gate for every change:
1. `bun run lint`
2. `bun run check-types`
3. Relevant smoke run (`bun run dev --filter=web` or `bun run dev --filter=cli`).

When adding tests, colocate with source as `*.test.ts`/`*.test.tsx` and wire a workspace `test` script.
