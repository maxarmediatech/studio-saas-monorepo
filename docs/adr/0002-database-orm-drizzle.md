# ADR-0002: Database ORM with Drizzle

## Status

Accepted

## Date

2024-12-23

## Context

We needed a database access layer that provides:
- Type safety with TypeScript
- Good developer experience
- Performance for production workloads
- Support for PostgreSQL
- Schema migrations

## Decision

We chose **Drizzle ORM** as our database toolkit.

### Implementation

```
packages/database/
├── drizzle/
│   ├── client.ts           # Database client setup
│   ├── schema/             # Table definitions
│   │   ├── postgres.ts     # PostgreSQL schema
│   │   └── index.ts
│   ├── queries/            # Reusable query functions
│   │   ├── users.ts
│   │   ├── organizations.ts
│   │   └── ...
│   ├── migrations/         # Generated migrations
│   └── zod.ts              # Zod schema generation
├── drizzle.config.ts       # Drizzle configuration
└── index.ts                # Package exports
```

## Consequences

### Positive

- **Type safety**: Full TypeScript inference from schema to queries
- **SQL-like syntax**: Familiar to developers who know SQL
- **Performance**: Minimal runtime overhead, generates efficient SQL
- **Zod integration**: Automatic validation schema generation
- **Migration system**: Built-in migration generation and tracking

### Negative

- **Newer ecosystem**: Less community resources compared to Prisma
- **Learning curve**: Different paradigm from traditional ORMs
- **Raw SQL knowledge**: Requires understanding of SQL concepts

### Neutral

- Need to run `db:generate` when schema changes
- Migration files are SQL, providing transparency

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| Prisma | Large ecosystem, great DX | Larger bundle, slower cold starts |
| TypeORM | Mature, decorator-based | Complex, less type-safe |
| Kysely | Pure query builder | No schema/migration system |
| Raw SQL | Maximum control | No type safety, error-prone |

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle with PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
