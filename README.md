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

- **Framework**: Next.js 15+ with App Router
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

## Links

- [NebulaForge Documentation](https://nebulaforge.dev/docs/nextjs)
- [Demo](https://demo.nebulaforge.dev)
