# ADR-0001: Monorepo Structure with Turborepo

## Status

Accepted

## Date

2024-12-23

## Context

Building a SaaS application requires managing multiple concerns: frontend, backend APIs, shared utilities, UI components, database access, authentication, payments, and more. We needed to decide between:

1. Multiple separate repositories (polyrepo)
2. A single repository containing all packages (monorepo)

## Decision

We chose a **monorepo structure using Turborepo** as the build orchestration tool with pnpm workspaces for package management.

### Structure

```
/
├── apps/
│   └── web/                 # Next.js application
├── packages/
│   ├── api/                 # API layer
│   ├── auth/                # Authentication
│   ├── database/            # Database access (Drizzle)
│   ├── i18n/                # Internationalization
│   ├── logs/                # Logging utilities
│   ├── mail/                # Email services
│   ├── payments/            # Payment integrations
│   ├── storage/             # File storage
│   ├── ui/                  # Shared UI components
│   └── utils/               # Shared utilities
├── tooling/
│   ├── tailwind/            # Tailwind configuration
│   ├── typescript/          # TypeScript configurations
│   └── scripts/             # Build/dev scripts
└── config/                  # Shared configuration
```

## Consequences

### Positive

- **Shared code**: Easy to share code between packages without publishing to npm
- **Atomic commits**: Changes across packages can be made in a single commit
- **Consistent tooling**: Same linting, formatting, and build tools across all packages
- **Better DX**: Single `pnpm dev` starts everything needed
- **Dependency management**: Shared dependencies reduce bundle size and conflicts

### Negative

- **Larger repository**: Clone times increase as project grows
- **Build complexity**: Need to manage build order and caching
- **Learning curve**: Team needs to understand Turborepo and workspace concepts

### Neutral

- CI/CD pipelines need to be configured for monorepo patterns
- IDE performance may vary with large codebases

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Polyrepo | Independent versioning, smaller repos | Harder to share code, version sync issues |
| Nx | More features, better caching | More complex, heavier tooling |
| Lerna | Mature ecosystem | Less active development, slower |

## References

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
