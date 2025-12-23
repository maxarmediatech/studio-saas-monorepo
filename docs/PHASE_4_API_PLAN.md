# Phase 4: API Layer Implementation Plan

> **Status**: Planning
> **Created**: 2024-12-19
> **Estimated Modules**: 9 domain modules + shared utilities

---

## Table of Contents

1. [Overview](#overview)
2. [Critical Requirements](#critical-requirements)
3. [Architecture Decisions](#architecture-decisions)
4. [Shared Infrastructure](#shared-infrastructure)
5. [Module Implementation Order](#module-implementation-order)
6. [Module Specifications](#module-specifications)
7. [Transaction & Idempotency Patterns](#transaction--idempotency-patterns)
8. [Testing Requirements](#testing-requirements)
9. [Implementation Checklist](#implementation-checklist)

---

## Overview

Phase 4 ports the W-Tales API routes to oRPC, following the NebulaForge patterns. The goal is to create a type-safe, well-documented API layer that supports both RPC-style and REST-style endpoints.

---

## Critical Requirements

> **MANDATORY**: These requirements are non-negotiable. Every procedure MUST comply.

### 1. Multi-Tenant Isolation (HARD REQUIREMENT)

**Every studio domain procedure MUST:**

1. **Use `studioProtectedProcedure`** - Never use `protectedProcedure` directly for studio domain endpoints
2. **Filter by `organizationId`** - Every database query MUST include `WHERE organizationId = ctx.organizationId`
3. **Validate ownership on mutations** - Before UPDATE/DELETE, verify the resource belongs to the organization

```typescript
// ❌ NEVER DO THIS - Data leakage risk
const booking = await db.query.bookings.findFirst({
  where: eq(bookings.id, input.id),
});

// ✅ ALWAYS DO THIS - Tenant-scoped
const booking = await db.query.bookings.findFirst({
  where: and(
    eq(bookings.id, input.id),
    eq(bookings.organizationId, ctx.organizationId)
  ),
});
```

**Enforcement**: The shared `studioProtectedProcedure` will inject `organizationId` into context. All queries MUST use this value.

### 2. RBAC Permission Enforcement (HARD REQUIREMENT)

**Every mutation procedure MUST use `requirePermission`:**

```typescript
// ❌ NEVER DO THIS - Bypasses RBAC
export const createBooking = studioProtectedProcedure
  .input(createBookingSchema)
  .handler(async ({ input, context }) => {
    // No permission check!
    return await db.insert(bookings).values({ ... });
  });

// ✅ ALWAYS DO THIS - Enforced RBAC
export const createBooking = studioProtectedProcedure
  .input(createBookingSchema)
  .handler(async ({ input, context }) => {
    requirePermission(context, "booking", "create");
    return await db.insert(bookings).values({ ... });
  });
```

**Permission Matrix by Role:**

| Role | Read | Create | Update | Delete | Assign | Approve |
|------|------|--------|--------|--------|--------|---------|
| owner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| manager | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| post_production_manager | ✅ | tasks/deliverables | tasks/deliverables | ❌ | tasks/deliverables | ✅ |
| hr | ✅ | crews | crews | ❌ | ❌ | ❌ |
| member | ✅ own | ❌ | ❌ own | ❌ | ❌ | ❌ |
| crew | ✅ assigned | ❌ | ❌ | ❌ | ❌ | ❌ |

### 3. Schema Source of Truth

**Single source of truth for schemas:**

```
/packages/api/modules/studio/schemas/   # ← Canonical shared schemas
├── common.ts                           # Pagination, enums, base types
├── booking.ts                          # Booking-related schemas
├── client.ts
├── ...
```

**Per-module schemas.ts files are PROHIBITED.** All schemas live in `/modules/studio/schemas/`.

Each module router imports from the shared schemas:

```typescript
// /modules/bookings/router.ts
import { createBookingSchema, bookingFiltersSchema } from "../studio/schemas/booking";
```

### 4. Response Envelope Standard

**All responses MUST follow the NebulaForge pattern:**

```typescript
// List response (matches existing /api/users pattern)
interface ListResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
}

// Single item response
interface ItemResponse<T> {
  data: T;
}

// Mutation response
interface MutationResponse {
  data: { id: string };
  message: string;
}
```

**Note**: Existing NebulaForge endpoints use `{ users, total }` style. New studio endpoints will use `{ data, pagination }` style for consistency within the studio domain. No compatibility layer needed as these are new endpoints.

### 5. Money Field Handling

**All money fields use DECIMAL in database and string in API:**

```typescript
// Schema
export const moneySchema = z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid money format");

// Example
const createBookingSchema = z.object({
  packageCost: moneySchema,  // "15000.00"
});

// In procedure - convert to Decimal for calculations
import Decimal from "decimal.js";
const cost = new Decimal(input.packageCost);
```

**Rationale**: JSON lacks a decimal type. Strings preserve precision and avoid floating-point errors.

### Key Patterns from NebulaForge

```
/packages/api/modules/{domain}/
├── router.ts                   # Exports domain router
├── procedures/                 # One file per endpoint
│   ├── create-{entity}.ts
│   ├── update-{entity}.ts
│   ├── delete-{entity}.ts
│   ├── get-{entity}.ts
│   └── list-{entities}.ts
├── lib/                        # Module-specific utilities (optional)
└── schemas.ts                  # Zod schemas for input/output
```

---

## Architecture Decisions

### 1. Authorization Strategy

We need a **studio-aware protected procedure** that:
- Validates user is authenticated
- Extracts and validates active organization from session
- Loads membership with role for RBAC checks

```typescript
// New procedure: studioProtectedProcedure
export const studioProtectedProcedure = protectedProcedure.use(
  async ({ context, next }) => {
    const organizationId = context.session.activeOrganizationId;

    if (!organizationId) {
      throw new ORPCError("FORBIDDEN", {
        message: "No active organization. Please select an organization."
      });
    }

    // Get member role for RBAC checks - validates membership is still valid
    const membership = await getMembership(context.user.id, organizationId);

    if (!membership) {
      throw new ORPCError("FORBIDDEN", {
        message: "Not a member of this organization"
      });
    }

    return await next({
      context: {
        organizationId,
        membership,
      },
    });
  },
);
```

**`activeOrganizationId` Management:**

The `activeOrganizationId` is stored in the session (via better-auth organization plugin):

1. **Set on login**: If user has only one org, auto-set. Otherwise, user must select.
2. **Updated via org switch**: Client calls `POST /api/auth/organization/set-active`
3. **Validated server-side**: The middleware re-validates membership on every request
4. **Cleared on membership revocation**: When user is removed from org, the session is invalidated

**Client-side handling:**
```typescript
// If 403 "No active organization" → redirect to org selector
// If 403 "Not a member" → session.activeOrganizationId is stale, clear and redirect
```

### 2. Permission Checking

**Required function that throws on failure:**

```typescript
// /modules/studio/lib/permissions.ts
import { ORPCError } from "orpc";
import { appRoles, type AppRole, type Resource, type Action } from "./roles";

/**
 * Throws FORBIDDEN if user lacks permission. Use in every mutation.
 */
export function requirePermission(
  context: { membership: { role: string } },
  resource: Resource,
  action: Action
): void {
  const role = appRoles[context.membership.role as keyof typeof appRoles];

  if (!role) {
    throw new ORPCError("FORBIDDEN", { message: "Invalid role" });
  }

  const allowed = role.statements[resource]?.includes(action) ?? false;

  if (!allowed) {
    throw new ORPCError("FORBIDDEN", {
      message: `Permission denied: ${action} on ${resource}`
    });
  }
}

/**
 * Check without throwing - use for conditional UI logic
 */
export function hasPermission(
  context: { membership: { role: string } },
  resource: Resource,
  action: Action
): boolean {
  const role = appRoles[context.membership.role as keyof typeof appRoles];
  if (!role) return false;
  return role.statements[resource]?.includes(action) ?? false;
}
```

### 3. Input Validation Pattern

**All schemas live in `/modules/studio/schemas/`** (see Critical Requirements #3).

```typescript
// /modules/studio/schemas/booking.ts
import { z } from "zod";
import { paginationSchema, moneySchema } from "./common";

export const createBookingSchema = z.object({
  name: z.string().min(1),
  bookingType: z.string(),
  packageType: z.string(),
  packageCost: moneySchema,  // "15000.00"
  participants: z.array(participantSchema).min(1),
});

export const bookingFiltersSchema = z.object({
  phase: z.enum(["new", "preparation", "shooting", "delivery", "completed", "cancelled"]).optional(),
  packageType: z.string().optional(),
  search: z.string().optional(),
}).merge(paginationSchema);
```

### 4. Query Encoding for List Endpoints

**oRPC uses POST for all procedures** including list/query operations. This means:
- No URL query string encoding issues
- Complex filters work naturally as JSON
- No caching via HTTP caching (use TanStack Query caching instead)

```typescript
// Client usage
const { data } = await client.bookings.list({
  phase: "shooting",
  dateRange: { start: "2024-01-01", end: "2024-12-31" },
  packageTypes: ["wedding", "pre-wedding"],
  page: 1,
  limit: 20,
});
```

**Do NOT create separate GET endpoints for simple queries.** All list operations use the standard procedure pattern.

---

## Shared Infrastructure

### Files to Create First (Phase 4.0)

```
/packages/api/
├── orpc/
│   └── procedures.ts              # Add studioProtectedProcedure
├── modules/
│   └── studio/
│       ├── lib/
│       │   ├── permissions.ts     # RBAC permission helpers (requirePermission, hasPermission)
│       │   ├── roles.ts           # Role definitions (port from W-Tales)
│       │   ├── queries.ts         # Shared query utilities (scoped finders)
│       │   └── transactions.ts    # Transaction helpers
│       └── schemas/               # ← SINGLE SOURCE OF TRUTH FOR ALL SCHEMAS
│           ├── common.ts          # Pagination, money, enums, base types
│           ├── booking.ts
│           ├── client.ts
│           ├── shoot.ts
│           ├── crew.ts
│           ├── task.ts
│           ├── deliverable.ts
│           ├── payment.ts
│           ├── expense.ts
│           └── configuration.ts
```

### Common Schema Definitions

```typescript
// /modules/studio/schemas/common.ts
import { z } from "zod";

// Pagination
export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// Money (string to preserve precision)
export const moneySchema = z.string().regex(
  /^\d+(\.\d{1,2})?$/,
  "Must be a valid money amount (e.g., '1500.00')"
);

// Date ranges
export const dateRangeSchema = z.object({
  start: z.string().date(),
  end: z.string().date(),
}).refine(
  (data) => new Date(data.start) <= new Date(data.end),
  { message: "Start date must be before or equal to end date" }
);

// ID validation
export const idSchema = z.string().uuid();
export const idsSchema = z.array(idSchema).min(1);

// Soft delete filter
export const includeDeletedSchema = z.boolean().default(false);
```

---

## Module Implementation Order

Based on dependencies and complexity:

| Order | Module | Depends On | Priority | Complexity |
|-------|--------|------------|----------|------------|
| 1 | **configurations** | - | High | Low |
| 2 | **clients** | configurations | High | Low |
| 3 | **crews** | - | High | Medium |
| 4 | **bookings** | clients, configurations | Critical | High |
| 5 | **shoots** | bookings, crews | High | Medium |
| 6 | **tasks** | bookings, crews | High | Medium |
| 7 | **deliverables** | bookings, crews | High | Medium |
| 8 | **payments** | bookings | High | Medium |
| 9 | **expenses** | bookings, shoots, crews | Medium | Medium |

---

## Module Specifications

### Module 1: Configurations

**Purpose**: Manage per-organization customizable settings (statuses, types, categories)

**Endpoints**:

| Method | Path | Procedure | Description |
|--------|------|-----------|-------------|
| GET | `/configurations` | `list` | List all configs by type |
| GET | `/configurations/{id}` | `get` | Get single config |
| POST | `/configurations` | `create` | Create new config |
| PUT | `/configurations/{id}` | `update` | Update config |
| DELETE | `/configurations/{id}` | `delete` | Delete config (if not system) |
| POST | `/configurations/seed` | `seed` | Seed default configs for org |

**File Structure**:
```
/modules/configurations/
├── router.ts
└── procedures/
    ├── list-configurations.ts
    ├── get-configuration.ts
    ├── create-configuration.ts
    ├── update-configuration.ts
    ├── delete-configuration.ts
    └── seed-configurations.ts
```
*(Schemas in `/modules/studio/schemas/configuration.ts`)*

---

### Module 2: Clients

**Purpose**: Customer/contact management

**Endpoints**:

| Method | Path | Procedure | Description |
|--------|------|-----------|-------------|
| GET | `/clients` | `list` | List clients with filters |
| GET | `/clients/{id}` | `get` | Get client detail |
| POST | `/clients` | `create` | Create client |
| PUT | `/clients/{id}` | `update` | Update client |
| DELETE | `/clients/{id}` | `delete` | Soft delete client |
| GET | `/clients/stats` | `stats` | Client statistics |

**File Structure**:
```
/modules/clients/
├── router.ts
└── procedures/
    ├── list-clients.ts
    ├── get-client.ts
    ├── create-client.ts
    ├── update-client.ts
    ├── delete-client.ts
    └── get-client-stats.ts
```
*(Schemas in `/modules/studio/schemas/client.ts`)*

---

### Module 3: Crews

**Purpose**: Team member management

**Endpoints**:

| Method | Path | Procedure | Description |
|--------|------|-----------|-------------|
| GET | `/crews` | `list` | List crews with filters |
| GET | `/crews/{id}` | `get` | Get crew detail |
| POST | `/crews` | `create` | Create crew |
| PUT | `/crews/{id}` | `update` | Update crew |
| DELETE | `/crews/{id}` | `delete` | Soft delete crew |
| GET | `/crews/availability` | `availability` | Get crew availability |
| POST | `/crews/from-member` | `createFromMember` | Create crew from org member |

**File Structure**:
```
/modules/crews/
├── router.ts
└── procedures/
    ├── list-crews.ts
    ├── get-crew.ts
    ├── create-crew.ts
    ├── update-crew.ts
    ├── delete-crew.ts
    ├── get-crew-availability.ts
    └── create-crew-from-member.ts
```
*(Schemas in `/modules/studio/schemas/crew.ts`)*

---

### Module 4: Bookings

**Purpose**: Core booking/project management

**Endpoints**:

| Method | Path | Procedure | Description |
|--------|------|-----------|-------------|
| GET | `/bookings` | `list` | List bookings with filters |
| GET | `/bookings/minimal` | `listMinimal` | Lightweight list for dropdowns |
| GET | `/bookings/{id}` | `get` | Get full booking detail |
| POST | `/bookings` | `create` | Create booking (with participants, shoots, etc.) |
| PUT | `/bookings/{id}` | `update` | Update booking |
| DELETE | `/bookings/{id}` | `delete` | Soft delete booking |
| GET | `/bookings/stats` | `stats` | Booking statistics |
| PUT | `/bookings/{id}/status` | `updateStatus` | Update booking phase |

**File Structure**:
```
/modules/bookings/
├── router.ts
├── lib/
│   └── booking-queries.ts      # Complex booking queries
└── procedures/
    ├── list-bookings.ts
    ├── list-bookings-minimal.ts
    ├── get-booking.ts
    ├── create-booking.ts
    ├── update-booking.ts
    ├── delete-booking.ts
    ├── get-booking-stats.ts
    └── update-booking-status.ts
```
*(Schemas in `/modules/studio/schemas/booking.ts`)*

---

### Module 5: Shoots

**Purpose**: Photo/video session management

**Endpoints**:

| Method | Path | Procedure | Description |
|--------|------|-----------|-------------|
| GET | `/shoots` | `list` | List shoots with filters |
| GET | `/shoots/minimal` | `listMinimal` | Lightweight list |
| GET | `/shoots/{id}` | `get` | Get shoot detail with assignments |
| POST | `/shoots` | `create` | Create shoot |
| PUT | `/shoots/{id}` | `update` | Update shoot |
| DELETE | `/shoots/{id}` | `delete` | Soft delete shoot |
| GET | `/shoots/stats` | `stats` | Shoot statistics |
| POST | `/shoots/{id}/assignments` | `assign` | Assign crew to shoot |
| DELETE | `/shoots/{id}/assignments/{crewId}` | `unassign` | Remove crew from shoot |
| POST | `/shoots/{id}/notify-crew` | `notifyCrew` | Send WhatsApp notification |

**File Structure**:
```
/modules/shoots/
├── router.ts
└── procedures/
    ├── list-shoots.ts
    ├── list-shoots-minimal.ts
    ├── get-shoot.ts
    ├── create-shoot.ts
    ├── update-shoot.ts
    ├── delete-shoot.ts
    ├── get-shoot-stats.ts
    ├── assign-crew.ts
    ├── unassign-crew.ts
    └── notify-crew.ts
```
*(Schemas in `/modules/studio/schemas/shoot.ts`)*

---

### Module 6: Tasks

**Purpose**: Production task management

**Endpoints**:

| Method | Path | Procedure | Description |
|--------|------|-----------|-------------|
| GET | `/tasks` | `list` | List tasks with filters |
| GET | `/tasks/{id}` | `get` | Get task detail |
| POST | `/tasks` | `create` | Create task |
| PUT | `/tasks/{id}` | `update` | Update task |
| DELETE | `/tasks/{id}` | `delete` | Soft delete task |
| GET | `/tasks/stats` | `stats` | Task statistics |
| POST | `/tasks/{id}/assignments` | `assign` | Assign crew to task |
| DELETE | `/tasks/{id}/assignments/{crewId}` | `unassign` | Remove crew |
| PUT | `/tasks/{id}/status` | `updateStatus` | Update task status |
| POST | `/tasks/{id}/submissions` | `submit` | Submit work for review |

**File Structure**:
```
/modules/tasks/
├── router.ts
└── procedures/
    ├── list-tasks.ts
    ├── get-task.ts
    ├── create-task.ts
    ├── update-task.ts
    ├── delete-task.ts
    ├── get-task-stats.ts
    ├── assign-crew.ts
    ├── unassign-crew.ts
    ├── update-task-status.ts
    └── submit-task.ts
```
*(Schemas in `/modules/studio/schemas/task.ts`)*

---

### Module 7: Deliverables

**Purpose**: Final output management (albums, videos)

**Endpoints**:

| Method | Path | Procedure | Description |
|--------|------|-----------|-------------|
| GET | `/deliverables` | `list` | List deliverables |
| GET | `/deliverables/minimal` | `listMinimal` | Lightweight list |
| GET | `/deliverables/{id}` | `get` | Get deliverable detail |
| POST | `/deliverables` | `create` | Create deliverable |
| PUT | `/deliverables/{id}` | `update` | Update deliverable |
| DELETE | `/deliverables/{id}` | `delete` | Soft delete |
| GET | `/deliverables/stats` | `stats` | Statistics |
| POST | `/deliverables/{id}/assignments` | `assign` | Assign crew |
| DELETE | `/deliverables/{id}/assignments/{crewId}` | `unassign` | Remove crew |
| POST | `/deliverables/{id}/convert-to-task` | `convertToTask` | Convert to task |
| POST | `/deliverables/{id}/submissions` | `submit` | Submit for review |

**File Structure**:
```
/modules/deliverables/
├── router.ts
└── procedures/
    ├── list-deliverables.ts
    ├── list-deliverables-minimal.ts
    ├── get-deliverable.ts
    ├── create-deliverable.ts
    ├── update-deliverable.ts
    ├── delete-deliverable.ts
    ├── get-deliverable-stats.ts
    ├── assign-crew.ts
    ├── unassign-crew.ts
    ├── convert-to-task.ts
    └── submit-deliverable.ts
```
*(Schemas in `/modules/studio/schemas/deliverable.ts`)*

---

### Module 8: Payments

**Purpose**: Payment tracking (received amounts + schedules)

**Endpoints**:

| Method | Path | Procedure | Description |
|--------|------|-----------|-------------|
| GET | `/payments/received` | `listReceived` | List received payments |
| GET | `/payments/received/{id}` | `getReceived` | Get payment detail |
| POST | `/payments/received` | `createReceived` | Record payment |
| PUT | `/payments/received/{id}` | `updateReceived` | Update payment |
| DELETE | `/payments/received/{id}` | `deleteReceived` | Delete payment |
| GET | `/payments/schedules` | `listSchedules` | List payment schedules |
| GET | `/payments/schedules/{id}` | `getSchedule` | Get schedule detail |
| POST | `/payments/schedules` | `createSchedule` | Create schedule |
| PUT | `/payments/schedules/{id}` | `updateSchedule` | Update schedule |
| DELETE | `/payments/schedules/{id}` | `deleteSchedule` | Delete schedule |
| POST | `/payments/schedules/{id}/convert` | `convertSchedule` | Convert to received |
| GET | `/payments/stats` | `stats` | Payment statistics |

**File Structure**:
```
/modules/payments/
├── router.ts
└── procedures/
    ├── received/
    │   ├── list-received.ts
    │   ├── get-received.ts
    │   ├── create-received.ts
    │   ├── update-received.ts
    │   └── delete-received.ts
    ├── schedules/
    │   ├── list-schedules.ts
    │   ├── get-schedule.ts
    │   ├── create-schedule.ts
    │   ├── update-schedule.ts
    │   ├── delete-schedule.ts
    │   └── convert-schedule.ts
    └── get-payment-stats.ts
```
*(Schemas in `/modules/studio/schemas/payment.ts`)*

---

### Module 9: Expenses

**Purpose**: Expense tracking

**Endpoints**:

| Method | Path | Procedure | Description |
|--------|------|-----------|-------------|
| GET | `/expenses` | `list` | List expenses |
| GET | `/expenses/{id}` | `get` | Get expense detail |
| POST | `/expenses` | `create` | Create expense |
| PUT | `/expenses/{id}` | `update` | Update expense |
| DELETE | `/expenses/{id}` | `delete` | Soft delete |
| GET | `/expenses/stats` | `stats` | Expense statistics |

**File Structure**:
```
/modules/expenses/
├── router.ts
└── procedures/
    ├── list-expenses.ts
    ├── get-expense.ts
    ├── create-expense.ts
    ├── update-expense.ts
    ├── delete-expense.ts
    └── get-expense-stats.ts
```
*(Schemas in `/modules/studio/schemas/expense.ts`)*

---

## Additional Modules (Support)

### Module: Dashboard

**Purpose**: Aggregated analytics

**Endpoints**:

| Method | Path | Procedure | Description |
|--------|------|-----------|-------------|
| GET | `/dashboard` | `get` | Get full dashboard data |
| GET | `/dashboard/kpis` | `kpis` | Financial KPIs |
| GET | `/dashboard/operations` | `operations` | Operational data |
| GET | `/dashboard/actions` | `actions` | Action items |

---

### Module: Submissions (Reviews)

**Purpose**: Submission review workflow

**Endpoints**:

| Method | Path | Procedure | Description |
|--------|------|-----------|-------------|
| GET | `/submissions` | `list` | List submissions for review |
| GET | `/submissions/{id}` | `get` | Get submission detail |
| POST | `/submissions/{id}/claim` | `claim` | Claim for review |
| POST | `/submissions/{id}/review` | `review` | Submit review decision |

---

### Module: My Assignments

**Purpose**: Current user's assignments

**Endpoints**:

| Method | Path | Procedure | Description |
|--------|------|-----------|-------------|
| GET | `/me/assignments` | `list` | List all assignments |
| GET | `/me/assignments/shoots` | `shoots` | My shoot assignments |
| GET | `/me/assignments/tasks` | `tasks` | My task assignments |
| GET | `/me/assignments/deliverables` | `deliverables` | My deliverable assignments |

---

## Transaction & Idempotency Patterns

### When to Use Transactions

**REQUIRED for operations that:**
1. Create/update multiple related entities
2. Must succeed or fail atomically
3. Depend on consistent reads during the operation

### Transaction Helper

```typescript
// /modules/studio/lib/transactions.ts
import { db } from "@acme/database";

export async function withTransaction<T>(
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await fn(tx);
  });
}
```

### Example: Booking Creation (Multi-Entity)

```typescript
// create-booking.ts
export const createBooking = studioProtectedProcedure
  .input(createBookingSchema)
  .handler(async ({ input, context }) => {
    requirePermission(context, "booking", "create");

    return await withTransaction(async (tx) => {
      // 1. Create booking
      const [booking] = await tx.insert(bookings).values({
        organizationId: context.organizationId,
        name: input.name,
        // ... other fields
      }).returning({ id: bookings.id });

      // 2. Create participants (if provided)
      if (input.participants?.length) {
        await tx.insert(bookingParticipants).values(
          input.participants.map(p => ({
            bookingId: booking.id,
            ...p,
          }))
        );
      }

      // 3. Create initial shoots (if provided)
      if (input.shoots?.length) {
        await tx.insert(shoots).values(
          input.shoots.map(s => ({
            bookingId: booking.id,
            organizationId: context.organizationId,
            ...s,
          }))
        );
      }

      // 4. Create default deliverables (if package type specifies them)
      // ... etc

      return { data: { id: booking.id }, message: "Booking created" };
    });
  });
```

### Example: Schedule to Received Conversion (Idempotent)

```typescript
// convert-schedule.ts
export const convertSchedule = studioProtectedProcedure
  .input(convertScheduleSchema)
  .handler(async ({ input, context }) => {
    requirePermission(context, "payment", "create");

    return await withTransaction(async (tx) => {
      // 1. Fetch schedule with lock
      const schedule = await tx.query.paymentSchedules.findFirst({
        where: and(
          eq(paymentSchedules.id, input.scheduleId),
          eq(paymentSchedules.organizationId, context.organizationId),
        ),
      });

      if (!schedule) {
        throw new ORPCError("NOT_FOUND");
      }

      // 2. Check if already converted (idempotency)
      if (schedule.status === "completed") {
        // Return existing - don't create duplicate
        const existing = await tx.query.receivedAmounts.findFirst({
          where: eq(receivedAmounts.scheduleId, schedule.id),
        });
        return {
          data: { id: existing?.id ?? schedule.id },
          message: "Schedule already converted",
        };
      }

      // 3. Create received amount
      const [received] = await tx.insert(receivedAmounts).values({
        organizationId: context.organizationId,
        bookingId: schedule.bookingId,
        scheduleId: schedule.id,
        amount: schedule.amount,
        method: input.method,
        receivedAt: new Date(),
      }).returning({ id: receivedAmounts.id });

      // 4. Update schedule status
      await tx.update(paymentSchedules)
        .set({ status: "completed" })
        .where(eq(paymentSchedules.id, schedule.id));

      return { data: { id: received.id }, message: "Payment recorded" };
    });
  });
```

### Operations Requiring Transactions

| Operation | Reason |
|-----------|--------|
| Create booking with participants/shoots | Multiple inserts must be atomic |
| Convert deliverable to task | Creates task + updates deliverable |
| Convert schedule to received | Creates received + updates schedule |
| Bulk crew assignment | Multiple assignment inserts |
| Delete booking | Cascading soft-delete of related entities |

---

## Testing Requirements

### Mandatory Test Categories

Every module MUST have tests covering:

#### 1. Multi-Tenant Isolation Tests
```typescript
describe("multi-tenant isolation", () => {
  it("should not return data from other organizations", async () => {
    // Create booking in org A
    const bookingA = await createBooking({ orgId: "org-a", ... });

    // Try to read from org B - should return null/empty
    const result = await client.bookings.get({ id: bookingA.id }, {
      headers: { "x-org-id": "org-b" }
    });

    expect(result.data).toBeNull();
  });

  it("should not allow mutation on other org's data", async () => {
    const bookingA = await createBooking({ orgId: "org-a", ... });

    await expect(
      client.bookings.delete({ id: bookingA.id }, {
        headers: { "x-org-id": "org-b" }
      })
    ).rejects.toThrow("NOT_FOUND");
  });
});
```

#### 2. RBAC Permission Tests
```typescript
describe("RBAC permissions", () => {
  it("should allow owner to delete", async () => {
    const result = await client.bookings.delete(
      { id: booking.id },
      { as: "owner" }
    );
    expect(result.message).toBe("Booking deleted");
  });

  it("should deny manager delete permission", async () => {
    await expect(
      client.bookings.delete({ id: booking.id }, { as: "manager" })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("should allow manager to update", async () => {
    const result = await client.bookings.update(
      { id: booking.id, name: "Updated" },
      { as: "manager" }
    );
    expect(result.data.id).toBe(booking.id);
  });
});
```

#### 3. Soft Delete Tests
```typescript
describe("soft delete", () => {
  it("should set deletedAt on delete", async () => {
    await client.bookings.delete({ id: booking.id });

    const raw = await db.query.bookings.findFirst({
      where: eq(bookings.id, booking.id),
    });
    expect(raw?.deletedAt).not.toBeNull();
  });

  it("should exclude deleted by default", async () => {
    await client.bookings.delete({ id: booking.id });

    const result = await client.bookings.list({});
    expect(result.data.map(b => b.id)).not.toContain(booking.id);
  });

  it("should include deleted when requested", async () => {
    await client.bookings.delete({ id: booking.id });

    const result = await client.bookings.list({ includeDeleted: true });
    expect(result.data.map(b => b.id)).toContain(booking.id);
  });
});
```

#### 4. Transaction Atomicity Tests
```typescript
describe("transaction atomicity", () => {
  it("should rollback all on participant validation failure", async () => {
    const countBefore = await db.select({ count: count() }).from(bookings);

    await expect(
      client.bookings.create({
        name: "Test",
        participants: [{ email: "invalid" }], // Invalid email
      })
    ).rejects.toThrow();

    const countAfter = await db.select({ count: count() }).from(bookings);
    expect(countAfter[0].count).toBe(countBefore[0].count);
  });
});
```

#### 5. Idempotency Tests
```typescript
describe("idempotency", () => {
  it("should handle duplicate schedule conversion", async () => {
    // First conversion
    const first = await client.payments.convertSchedule({
      scheduleId: schedule.id,
      method: "upi",
    });

    // Second conversion - should not create duplicate
    const second = await client.payments.convertSchedule({
      scheduleId: schedule.id,
      method: "upi",
    });

    expect(second.data.id).toBe(first.data.id);

    // Verify only one received amount exists
    const received = await db.query.receivedAmounts.findMany({
      where: eq(receivedAmounts.scheduleId, schedule.id),
    });
    expect(received).toHaveLength(1);
  });
});
```

### Test File Structure

```
/packages/api/modules/{module}/
└── __tests__/
    ├── {module}.test.ts         # Main procedure tests
    ├── permissions.test.ts       # RBAC tests
    └── isolation.test.ts         # Multi-tenant tests
```

### CI Requirements

All tests must pass before:
- PR can be merged
- Module is marked complete in checklist

---

## Implementation Checklist

### Phase 4.0: Shared Infrastructure
- [ ] Create `studioProtectedProcedure` in `/orpc/procedures.ts`
- [ ] Port RBAC roles to `/modules/studio/lib/roles.ts`
- [ ] Create permission helpers (`requirePermission`, `hasPermission`) in `/modules/studio/lib/permissions.ts`
- [ ] Create transaction helper in `/modules/studio/lib/transactions.ts`
- [ ] Create common schemas in `/modules/studio/schemas/common.ts`
- [ ] **Verify**: studioProtectedProcedure injects organizationId correctly
- [ ] **Verify**: requirePermission throws FORBIDDEN on denied access

### Phase 4.1: Configurations Module
- [ ] Create schemas in `/modules/studio/schemas/configuration.ts`
- [ ] Implement all procedures (6)
- [ ] Register in root router
- [ ] **Tests**: Multi-tenant isolation
- [ ] **Tests**: RBAC permissions

### Phase 4.2: Clients Module
- [ ] Create schemas in `/modules/studio/schemas/client.ts`
- [ ] Implement all procedures (6)
- [ ] Register in root router
- [ ] **Tests**: Multi-tenant isolation
- [ ] **Tests**: RBAC permissions
- [ ] **Tests**: Soft delete behavior

### Phase 4.3: Crews Module
- [ ] Create schemas in `/modules/studio/schemas/crew.ts`
- [ ] Implement all procedures (7)
- [ ] Register in root router
- [ ] **Tests**: Multi-tenant isolation
- [ ] **Tests**: RBAC permissions
- [ ] **Tests**: Soft delete behavior

### Phase 4.4: Bookings Module
- [ ] Create schemas in `/modules/studio/schemas/booking.ts`
- [ ] Port complex booking queries to `/modules/bookings/lib/`
- [ ] Implement all procedures (8)
- [ ] Register in root router
- [ ] **Tests**: Multi-tenant isolation
- [ ] **Tests**: RBAC permissions
- [ ] **Tests**: Transaction atomicity (create with participants)
- [ ] **Tests**: Soft delete behavior

### Phase 4.5: Shoots Module
- [ ] Create schemas in `/modules/studio/schemas/shoot.ts`
- [ ] Implement all procedures (10)
- [ ] Register in root router
- [ ] **Tests**: Multi-tenant isolation
- [ ] **Tests**: RBAC permissions
- [ ] **Tests**: Soft delete behavior

### Phase 4.6: Tasks Module
- [ ] Create schemas in `/modules/studio/schemas/task.ts`
- [ ] Implement all procedures (10)
- [ ] Register in root router
- [ ] **Tests**: Multi-tenant isolation
- [ ] **Tests**: RBAC permissions
- [ ] **Tests**: Soft delete behavior

### Phase 4.7: Deliverables Module
- [ ] Create schemas in `/modules/studio/schemas/deliverable.ts`
- [ ] Implement all procedures (11)
- [ ] Register in root router
- [ ] **Tests**: Multi-tenant isolation
- [ ] **Tests**: RBAC permissions
- [ ] **Tests**: Transaction atomicity (convert to task)
- [ ] **Tests**: Soft delete behavior

### Phase 4.8: Payments Module
- [ ] Create schemas in `/modules/studio/schemas/payment.ts`
- [ ] Implement received procedures (5)
- [ ] Implement schedule procedures (6)
- [ ] Implement stats procedure
- [ ] Register in root router
- [ ] **Tests**: Multi-tenant isolation
- [ ] **Tests**: RBAC permissions
- [ ] **Tests**: Idempotency (schedule conversion)

### Phase 4.9: Expenses Module
- [ ] Create schemas in `/modules/studio/schemas/expense.ts`
- [ ] Implement all procedures (6)
- [ ] Register in root router
- [ ] **Tests**: Multi-tenant isolation
- [ ] **Tests**: RBAC permissions
- [ ] **Tests**: Soft delete behavior

### Phase 4.10: Support Modules
- [ ] Dashboard module (with all test categories)
- [ ] Submissions module (with all test categories)
- [ ] My Assignments module (with all test categories)

---

## File Count Summary

| Module | Procedures | Router | Tests | Total |
|--------|------------|--------|-------|-------|
| Shared Infrastructure (schemas, lib) | - | - | - | 14 |
| Configurations | 6 | 1 | 2 | 9 |
| Clients | 6 | 1 | 3 | 10 |
| Crews | 7 | 1 | 3 | 11 |
| Bookings | 8 | 1 | 4 | 13 |
| Shoots | 10 | 1 | 3 | 14 |
| Tasks | 10 | 1 | 3 | 14 |
| Deliverables | 11 | 1 | 4 | 16 |
| Payments | 12 | 1 | 3 | 16 |
| Expenses | 6 | 1 | 3 | 10 |
| Dashboard | 4 | 1 | 3 | 8 |
| Submissions | 4 | 1 | 3 | 8 |
| My Assignments | 4 | 1 | 3 | 8 |
| **Total** | **88** | **12** | **37** | **141** |

**Shared Infrastructure breakdown:**
- `/modules/studio/lib/`: roles.ts, permissions.ts, transactions.ts, queries.ts (4)
- `/modules/studio/schemas/`: common.ts + 9 domain schemas (10)

---

## Summary of Critical Requirements

1. **Multi-Tenant Isolation**: All procedures use `studioProtectedProcedure`; all queries filter by `organizationId`
2. **RBAC Enforcement**: All mutations call `requirePermission()`
3. **Schema Source of Truth**: All schemas in `/modules/studio/schemas/`
4. **Response Envelope**: `{ data, pagination }` for lists, `{ data }` for items
5. **Money Handling**: String format with Decimal.js for calculations
6. **Transactions**: Required for multi-entity operations
7. **Idempotency**: Conversions check for existing results
8. **Testing**: Every module has isolation, RBAC, and soft-delete tests

---

## Next Steps

1. Review and approve this plan
2. Start with Phase 4.0 (Shared Infrastructure)
3. Implement modules in order
4. Each module must pass all tests before moving to the next

---

*This document will be updated as implementation progresses.*
