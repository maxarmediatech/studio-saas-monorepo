# Contributing Guide

Welcome! This guide covers everything you need to know to contribute to this project.

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm 10.23.0+
- PostgreSQL database

### Setup

```bash
# Clone the repository
git clone git@github.com:ra-kesh/studio-saas-monorepo-personal.git
cd studio-saas-monorepo-personal

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Run database migrations
pnpm db:migrate

# Start development
pnpm dev
```

## Project Structure

```
├── apps/web          # Next.js application
├── packages/         # Shared packages
├── tooling/          # Build tooling
├── config/           # Shared config
└── docs/             # Documentation
```

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed architecture overview.

## Development Workflow

### Branch Naming

Use descriptive branch names:

```
feature/add-user-dashboard
fix/login-redirect-issue
refactor/auth-middleware
docs/update-readme
```

### Commit Messages

Follow conventional commits:

```
feat: add user profile page
fix: resolve authentication timeout
docs: update API documentation
refactor: simplify database queries
chore: update dependencies
```

### Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Run checks: `pnpm typecheck && pnpm lint`
4. Push and create a PR
5. Fill out the PR template
6. Request review

## Code Standards

### TypeScript

- Strict mode enabled
- Explicit return types for exported functions
- Use `type` over `interface` for consistency
- Avoid `any` - use `unknown` if type is truly unknown

### Formatting & Linting

We use [Biome](https://biomejs.dev/) for formatting and linting:

```bash
# Check formatting and lint
pnpm check

# Fix issues
pnpm format
pnpm lint --write
```

### File Organization

```typescript
// 1. External imports
import { useState } from "react"

// 2. Internal package imports
import { Button } from "@repo/ui/components/button"

// 3. Relative imports
import { useAuth } from "./hooks/use-auth"

// 4. Types
type Props = {
  title: string
}
```

### Component Structure

```typescript
// component-name.tsx

type ComponentNameProps = {
  // props
}

export function ComponentName({ prop }: ComponentNameProps) {
  // hooks first
  // derived state
  // handlers
  // return JSX
}
```

## Package Development

### Creating a New Package

1. Create directory in `packages/`
2. Add `package.json` with `@repo/` namespace
3. Add `tsconfig.json` extending base config
4. Export from `index.ts`
5. Add to consuming app's dependencies

### Package Dependencies

- Use `workspace:*` for internal packages
- Keep external dependencies minimal
- Shared deps go in root `package.json`

## Database Changes

### Schema Changes

1. Modify schema in `packages/database/drizzle/schema/`
2. Generate migration: `pnpm db:generate`
3. Review generated SQL in `drizzle/migrations/`
4. Apply migration: `pnpm db:migrate`

### Writing Queries

Place reusable queries in `packages/database/drizzle/queries/`:

```typescript
// queries/users.ts
export async function getUserById(id: string) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  })
}
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Architecture Decisions

When making significant architectural changes:

1. Create an ADR in `docs/adr/`
2. Use the template: `docs/adr/0000-adr-template.md`
3. Get team review before implementing
4. Update ADR status after decision

## Getting Help

- Check existing [ADRs](./docs/adr/) for context on decisions
- Review [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for system overview
- Ask questions in PR comments or team chat

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
