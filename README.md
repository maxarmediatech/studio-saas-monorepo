# Studio SaaS Monorepo

A production-ready, scalable SaaS application built with Next.js, Turborepo, and modern tooling.

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local

# Run database migrations
pnpm db:migrate

# Start development
pnpm dev
```

## Documentation

| Document | Description |
|----------|-------------|
| [Setup Guide](./docs/SETUP.md) | Complete setup & deployment guide |
| [Architecture](./docs/ARCHITECTURE.md) | System overview and package structure |
| [ADRs](./docs/adr/README.md) | Architecture Decision Records |
| [Contributing](./CONTRIBUTING.md) | Development guidelines |

## Project Structure

```
├── apps/web          # Next.js application
├── packages/         # Shared packages (ui, database, auth, etc.)
├── tooling/          # Build configuration
├── config/           # Shared app config
└── docs/             # Documentation
```

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Build**: Turborepo + pnpm workspaces
- **Database**: PostgreSQL + Drizzle ORM
- **UI**: shadcn/ui + Tailwind CSS 4
- **Language**: TypeScript (strict mode)
- **Linting**: Biome

## Commands

```bash
pnpm dev          # Start development server
pnpm build        # Build all packages
pnpm typecheck    # TypeScript checks
pnpm lint         # Run linter
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Apply migrations
```


## License

Copyright (C) 2025-2026 Maxar Media Private Limited

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, version 3 of the License.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the [LICENSE](LICENSE) file for details.

If you run a modified version of this software as a network service, the AGPL requires you to make your modified source code available to its users.
