# Repository Guidelines

## Project Structure & Module Organization
- `apps/web`: Primary Next.js SaaS application (routes in `app/`, legacy code in `app_legacy/`).
- `packages/*`: Shared domain modules (`@repo/api`, `@repo/auth`, `@repo/database`, `@repo/utils`, etc.).
- `config` and `tooling`: Shared configuration (TypeScript, linting, CI) and internal scripts.
- Tests currently live in `apps/web/tests` with Playwright configuration in `apps/web/playwright.config.ts`.

## Build, Test & Development Commands
- `pnpm install` – install all workspace dependencies (Node >= 20, PNPM as per `package.json`).
- `pnpm dev` – start Turbo dev for all apps, loading env via `dotenv-cli`.
- `cd apps/web && pnpm dev` – run the web app locally only.
- `pnpm build` – Turbo build for all packages and apps.
- `pnpm lint` / `pnpm check` – run Biome linting and diagnostics; `pnpm format` applies formatting.
- `cd apps/web && pnpm e2e` / `pnpm e2e:ci` – run Playwright E2E tests locally / in CI.

## Coding Style & Naming Conventions
- Primary stack is TypeScript + React/Next.js; use functional components and hooks.
- Formatting and linting are enforced by Biome; use `pnpm lint` and `pnpm format` (tabs, width 4 from `.editorconfig`).
- Use kebab-case for file and folder names (e.g., `user-settings-panel.tsx`); PascalCase for React components; `useX` for hooks.
- Shared logic should live in `packages/*` and be imported via `@repo/...` aliases.

## Testing Guidelines
- E2E tests use `@playwright/test` under `apps/web/tests/*.spec.ts` (e.g., `home.spec.ts`).
- When changing routing or critical flows, add/update Playwright specs to cover happy paths and failure states.
- Run `cd apps/web && pnpm e2e` before merging user-facing changes.

## Commit & Pull Request Guidelines
- Use clear, imperative commit messages (e.g., `Update billing webhook handler`).
- Keep commits focused; separate refactors from behavioral changes when possible.
- PRs should include a concise summary, linked issues, and screenshots/recordings for UI changes.
- Ensure `pnpm lint`, `pnpm build`, and relevant tests pass before requesting review.

## Next.js & Agent-Specific Instructions

**Next.js Initialization**: When starting work on a Next.js project, automatically
call the `init` tool from the next-devtools-mcp server FIRST. This establishes
proper context and ensures all Next.js queries use official documentation.

## Environment & Configuration
- Copy `.env.local.example` to `.env.local` and fill required values before running `pnpm dev`.
- Never commit secrets; rely on environment variables and CI secret management.
- When introducing new env vars, update `.env.local.example` and document them in the PR description.
