# Architecture Overview

This document provides a high-level overview of the Studio SaaS Monorepo architecture.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              APPS LAYER                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         apps/web (Next.js)                           │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │    │
│  │  │  Pages   │ │  Routes  │ │  Layouts │ │Components│ │  Hooks   │   │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PACKAGES LAYER                                    │
│                                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │   api   │ │  auth   │ │database │ │  mail   │ │payments │ │ storage │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│                                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                                        │
│  │   ui    │ │  i18n   │ │  logs   │                                        │
│  └─────────┘ └─────────┘ └─────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TOOLING LAYER                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                         │
│  │  typescript  │ │   tailwind   │ │   scripts    │                         │
│  │   configs    │ │    config    │ │  utilities   │                         │
│  └──────────────┘ └──────────────┘ └──────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
studio-saas-monorepo/
├── apps/
│   └── web/                    # Next.js frontend application
├── packages/
│   ├── api/                    # API layer and endpoints
│   ├── auth/                   # Authentication & authorization
│   ├── database/               # Database schema, queries, migrations
│   ├── i18n/                   # Internationalization
│   ├── logs/                   # Logging utilities
│   ├── mail/                   # Email services
│   ├── payments/               # Payment provider integrations
│   ├── storage/                # File storage abstraction
│   ├── ui/                     # Shared UI components (shadcn/ui)
│   └── utils/                  # Shared utilities
├── tooling/
│   ├── tailwind/               # Tailwind CSS configuration
│   ├── typescript/             # Shared TypeScript configs
│   └── scripts/                # Development scripts
├── config/                     # Shared application configuration
└── docs/                       # Documentation
    └── adr/                    # Architecture Decision Records
```

## Package Details

### `apps/web`
The main Next.js application serving the frontend. Uses App Router for routing and React Server Components where appropriate.

**Key technologies:**
- Next.js 15+
- React 19
- Tailwind CSS 4

### `packages/database`
Database access layer using Drizzle ORM with PostgreSQL.

**Responsibilities:**
- Schema definitions
- Migration management
- Type-safe queries
- Zod validation schemas

### `packages/auth`
Authentication and session management.

**Features:**
- Session-based authentication
- OAuth provider support
- Organization/team context
- Role-based access control
- Team-optional memberships (users can belong to zero or many teams)

**Checkins scope model:**
- Checkin types support `organization` scope (all org members) or `team` scope (team members only)
- Teams are enabled, but default team auto-creation is disabled

### `packages/ui`
Shared UI component library based on shadcn/ui.

**Includes:**
- 50+ accessible components
- Radix UI primitives
- Tailwind CSS styling
- Custom hooks

### `packages/payments`
Payment provider integrations.

**Supported providers:**
- Polar
- Dodo Payments
- Creem

### `packages/mail`
Email service abstraction for transactional emails.

### `packages/storage`
File storage abstraction for uploads and media.

### `packages/i18n`
Internationalization support for multi-language applications.

### `packages/logs`
Structured logging utilities.

## Data Flow

```
User Request
     │
     ▼
┌─────────────┐
│   Next.js   │ ◄── Server Components / API Routes
│   (web)     │
└─────────────┘
     │
     ▼
┌─────────────┐
│    API      │ ◄── Business logic, validation
│  (packages) │
└─────────────┘
     │
     ├──────────────┬──────────────┬──────────────┐
     ▼              ▼              ▼              ▼
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│Database │   │  Auth   │   │Payments │   │ Storage │
└─────────┘   └─────────┘   └─────────┘   └─────────┘
     │              │              │              │
     ▼              ▼              ▼              ▼
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│PostgreSQL│   │Sessions │   │ Polar/  │   │   S3/   │
│         │   │         │   │  Dodo   │   │  Local  │
└─────────┘   └─────────┘   └─────────┘   └─────────┘
```

## Key Patterns

### Package Imports
All internal packages use the `@repo/` namespace:

```typescript
import { Button } from "@repo/ui/components/button"
import { db } from "@repo/database"
import { auth } from "@repo/auth"
```

### Configuration
Shared configuration lives in `/config` and is imported as `@repo/config`:

```typescript
import { appConfig } from "@repo/config"
```

### Type Safety
- All packages export TypeScript types
- Drizzle generates types from schema
- Zod schemas provide runtime validation

## Build System

**Turborepo** orchestrates builds with:
- Parallel task execution
- Remote caching support
- Dependency-aware build order

```bash
pnpm dev        # Start all apps in development
pnpm build      # Build all packages and apps
pnpm typecheck  # Run TypeScript checks
pnpm lint       # Run Biome linter
```

## Environment Configuration

Environment variables are managed via:
- `.env.local` for local development
- `dotenv-cli` for loading in scripts

## Related Documentation

- [ADR Index](./adr/README.md) - Architecture decisions
- [Contributing Guide](../CONTRIBUTING.md) - Development guidelines
