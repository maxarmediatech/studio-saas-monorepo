# W-Tales to Lumen Migration Plan

> **Document Version**: 1.1  
> **Created**: 2024-12-18  
> **Last Updated**: 2024-12-18  
> **Status**: Planning Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Source Application: W-Tales Studio](#source-application-w-tales-studio)
3. [Target Template: Lumen Monorepo](#target-template-lumen-monorepo)
4. [Schema Review & Improvements](#schema-review--improvements)
5. [Schema Comparison](#schema-comparison)
6. [Final Unified Schema Plan](#final-unified-schema-plan)
   - [Status Fields Strategy: Hybrid Approach](#status-fields-strategy-hybrid-approach)
   - [Enum Definitions (System-Critical Only)](#enum-definitions-system-critical-only)
   - [Configurations Table (Enhanced)](#configurations-table-enhanced)
   - [Key Table Definitions](#key-table-definitions-improved)
7. [Migration Phases](#migration-phases)
8. [Decisions Log](#decisions-log)
9. [References](#references)

---

## Executive Summary

This document outlines the migration plan for porting **W-Tales Studio** (a photography/videography studio management application) to the **Lumen SaaS monorepo template**.

### Goals
- Leverage Lumen's mature SaaS infrastructure (auth, billing, monorepo structure)
- Preserve all W-Tales domain functionality (bookings, shoots, crews, deliverables, payments)
- Apply schema improvements identified during review
- Maintain clean separation of concerns via monorepo packages

### Key Metrics
| Metric | W-Tales | Lumen | Final |
|--------|---------|-------------|-------|
| Database Tables | 30+ | 8 | ~35 |
| API Endpoints | ~50 | ~20 | ~70 |
| Custom Hooks | 60+ | ~10 | ~70 |
| UI Components | 40+ | 30+ | ~50 |

---

## Source Application: W-Tales Studio

### Overview
**W-Tales Studio** is a comprehensive studio management application designed for wedding/event photography studios. It provides tools for managing the entire workflow from client booking to final deliverable handoff.

### Tech Stack
| Layer | Technology |
|-------|------------|
| Framework | Next.js 15.5 with Turbopack |
| Runtime | React 19, TypeScript 5.8 |
| Database | PostgreSQL (Railway) |
| ORM | Drizzle ORM |
| Auth | better-auth (Google OAuth, email/password, organizations) |
| Styling | Tailwind CSS 4, shadcn/ui |
| State | TanStack Query, React Hook Form, nuqs |
| Monitoring | Sentry |
| Email | Resend |
| Messaging | Twilio WhatsApp |
| Storage | AWS S3 |

### Domain Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ORGANIZATION                                 │
│  (Studio - multi-tenant isolation)                                  │
└─────────────────────────────────────────────────────────────────────┘
         │
         ├── CLIENTS (Customer contacts)
         │      └── BookingParticipants (bride, groom, company)
         │
         ├── BOOKINGS (Core entity - wedding/event projects)
         │      ├── Phase: new → preparation → shooting → delivery → completed
         │      ├── Shoots (scheduled photo/video sessions)
         │      ├── Tasks (work items with workflow)
         │      ├── Deliverables (albums, videos, etc.)
         │      ├── Expenses (studio or client billable)
         │      └── Payments (received amounts, schedules, invoices)
         │
         ├── CREWS (Staff members)
         │      ├── Linked to Members (optional)
         │      ├── Assignments (shoots, tasks, deliverables)
         │      └── Feedback & Availability
         │
         ├── CONFIGURATIONS (Dynamic settings)
         │      └── booking_type, package_type, task_status, etc.
         │
         └── MESSAGING (WhatsApp integration)
                └── Conversations & Messages
```

### Role-Based Access Control

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **owner** | Studio owner | Full access to everything |
| **admin** | Studio administrator | Full access except ownership transfer |
| **manager** | Project manager | Shoots, tasks, deliverables, crew assignment |
| **post_production_manager** | Post-production lead | Deliverables, tasks, reviews |
| **hr** | HR/Finance | Expenses, payments, read-only on operations |
| **member** | General staff | Limited to assigned tasks/deliverables |
| **crew** | External crew | Own task submissions only |

### File Structure
```
w-tales/
├── src/
│   ├── app/
│   │   ├── (dashboard)/          # Main app routes
│   │   │   ├── bookings/
│   │   │   ├── clients/
│   │   │   ├── shoots/
│   │   │   ├── crews/
│   │   │   ├── tasks/
│   │   │   ├── deliverables/
│   │   │   ├── expenses/
│   │   │   ├── payments/
│   │   │   ├── reviews/
│   │   │   ├── settings/
│   │   │   └── configurations/
│   │   ├── (login)/              # Auth routes
│   │   └── api/                  # API routes
│   ├── components/               # UI components
│   ├── hooks/                    # 60+ custom hooks
│   ├── lib/
│   │   ├── auth/                 # better-auth setup
│   │   ├── db/
│   │   │   ├── schema.ts         # Drizzle schema
│   │   │   └── queries/          # Database queries
│   │   └── email/                # Email templates
│   └── types/                    # TypeScript types
└── drizzle/                      # Migrations
```

---

## Target Template: Lumen Monorepo

### Overview
**Lumen** is a production-ready SaaS starter template built as a PNPM monorepo with Turborepo orchestration. It provides authentication, organization management, payments, and a solid foundation for B2B SaaS applications.

### Tech Stack
| Layer | Technology |
|-------|------------|
| Monorepo | PNPM Workspaces + Turborepo |
| Framework | Next.js 16 with App Router |
| Runtime | React 19, TypeScript 5.9 |
| Database | PostgreSQL with Drizzle ORM |
| Auth | better-auth (organizations, 2FA, social login) |
| API | oRPC + Hono (OpenAPI compatible) |
| Payments | Multi-provider (Stripe, LemonSqueezy, etc.) |
| Styling | Tailwind CSS 4, shadcn/ui |
| i18n | next-intl |

### Monorepo Structure
```
studio-saas-monorepo/
├── apps/
│   └── web/                      # Main Next.js application
│       ├── app/
│       │   ├── (saas)/           # Protected SaaS routes
│       │   │   └── app/[organizationSlug]/
│       │   ├── auth/             # Auth routes
│       │   └── api/              # API handlers
│       └── modules/              # Feature modules
├── packages/
│   ├── api/                      # oRPC API layer
│   │   ├── modules/              # API modules
│   │   └── orpc/                 # oRPC setup
│   ├── auth/                     # better-auth configuration
│   ├── database/                 # Drizzle schema & queries
│   │   └── drizzle/
│   │       ├── schema/
│   │       ├── queries/
│   │       └── migrations/
│   ├── payments/                 # Payment provider abstraction
│   ├── mail/                     # Email service
│   ├── storage/                  # File storage (S3)
│   ├── i18n/                     # Internationalization
│   ├── ui/                       # Shared UI components
│   ├── utils/                    # Utilities
│   └── logs/                     # Logging
├── config/                       # Shared configuration
└── tooling/                      # Build tools & scripts
```

### Existing Database Schema
```typescript
// Auth & User Management
users, sessions, accounts, verifications, twoFactors

// Organization Management
organizations, members, invitations

// SaaS Billing
purchases, webhookEvents
```

---

## Schema Review & Improvements

### Critical Issues Identified

#### 1. Inconsistent Date/Time Data Types
**Problem**: Dates and times stored as `text` instead of proper types.

| Table | Field | Current | Should Be |
|-------|-------|---------|-----------|
| shoots | date | text | date |
| shoots | time | text | time |
| shoots | duration | text | integer (minutes) |
| tasks | startDate | text | date |
| tasks | dueDate | text | date |
| deliverables | dueDate | text | date |

**Impact**: Cannot use date comparisons, range queries, or timezone handling.

#### 2. Inconsistent Timestamp Timezone Handling
**Problem**: Mixed usage of `timestamp` with and without timezone.

**Recommendation**: Standardize ALL timestamps to `timestamp with timezone` for multi-region support.

#### 3. Missing Critical Indexes
**Problem**: Common query patterns lack supporting indexes.

```typescript
// Required indexes
bookings: (organizationId, status), (organizationId, createdAt)
shoots: (organizationId, date), (bookingId)
tasks: (organizationId, status), (bookingId), (deliverableId)
deliverables: (organizationId, status), (bookingId)
receivedAmounts: (bookingId), (organizationId, paidOn)
clients: unique(organizationId, phoneNumber), unique(organizationId, email)
invoices: unique(organizationId, invoiceNumber)
```

### High Priority Improvements

#### 4. Soft Delete Inconsistency
**Problem**: Only `bookings` has `deletedAt`. Other entities cascade delete, losing historical data.

**Recommendation**: Add soft delete to critical entities:
- clients, shoots, deliverables, tasks, expenses, crews

```typescript
deletedAt: timestamp("deleted_at", { withTimezone: true }),
deletedBy: varchar("deleted_by", { length: 255 }).references(() => users.id),
```

#### 5. Missing Audit Fields
**Problem**: No tracking of who created/updated records.

**Recommendation**: Add to all domain tables:
```typescript
createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
updatedBy: varchar("updated_by", { length: 255 }).references(() => users.id),
```

#### 6. Payment Method Missing
**Problem**: `receivedAmounts` doesn't track payment method.

**Recommendation**:
```typescript
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash", "upi", "bank_transfer", "cheque", "card", "other"
]);

// Add to receivedAmounts
paymentMethod: paymentMethodEnum("payment_method"),
transactionReference: text("transaction_reference"),
```

#### 7. Booking Financial Summary Missing
**Problem**: Requires aggregating multiple tables for financial overview.

**Recommendation**: Add cached/computed fields to bookings:
```typescript
totalReceived: decimal("total_received", { precision: 12, scale: 2 }).default("0"),
totalExpenses: decimal("total_expenses", { precision: 12, scale: 2 }).default("0"),
balanceDue: decimal("balance_due", { precision: 12, scale: 2 }),
```

### Medium Priority Improvements

#### 8. Status Fields Strategy: Hybrid Approach
**Problem**: Using `text` for statuses allows invalid values, but hard-coded enums prevent owner customization.

**Solution**: Use a **hybrid approach**:
- **Hard-coded Enums** for system-critical statuses (business logic depends on them)
- **Configurable via `configurations` table** for display/organizational statuses (owners can customize)

See [Status Fields Strategy](#status-fields-strategy-hybrid-approach-1) section for full details.

#### 9. Missing Booking Reference Number
**Problem**: Bookings lack human-readable identifiers.

**Recommendation**:
```typescript
referenceNumber: varchar("reference_number", { length: 50 }).notNull(),
// Format: WED-2024-0042, EVT-2024-0015
// Unique per organization
```

#### 10. Shoots Status Missing
**Problem**: No way to track shoot lifecycle.

**Recommendation**: Add `shootStatusEnum` with values: scheduled, confirmed, in_progress, completed, cancelled, postponed.

### Low Priority / Nice to Have

#### 11. Crew Availability Calendar
**Purpose**: Proper scheduling and conflict detection.

```typescript
export const crewAvailability = pgTable("crew_availability", {
  id: varchar("id", { length: 255 }).$defaultFn(() => uuidv7()).primaryKey(),
  crewId: varchar("crew_id", { length: 255 }).notNull().references(() => crews.id),
  date: date("date").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  availableFrom: time("available_from"),
  availableTo: time("available_to"),
  reason: text("reason"), // "leave", "personal", "booked"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  uniqueIndex("crew_availability_crew_date_idx").on(t.crewId, t.date),
]);
```

#### 12. Booking Events Table
**Purpose**: Handle multi-day wedding events.

```typescript
export const bookingEvents = pgTable("booking_events", {
  id: varchar("id", { length: 255 }).$defaultFn(() => uuidv7()).primaryKey(),
  bookingId: varchar("booking_id", { length: 255 }).notNull().references(() => bookings.id),
  eventType: text("event_type").notNull(), // engagement, haldi, sangeet, wedding, reception
  eventDate: date("event_date").notNull(),
  venue: text("venue"),
  venueAddress: text("venue_address"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

### Summary Table

| Issue | Severity | Effort | Status |
|-------|----------|--------|--------|
| Date/time as text | Critical | Medium | ⬜ Pending |
| Timezone inconsistency | Critical | Low | ⬜ Pending |
| Missing indexes | Critical | Low | ⬜ Pending |
| Soft delete inconsistency | High | Medium | ⬜ Pending |
| Missing audit fields | High | Medium | ⬜ Pending |
| Payment method missing | High | Low | ⬜ Pending |
| Booking financial cache | High | Medium | ⬜ Pending |
| Text status → Enums | Medium | Medium | ⬜ Pending |
| Missing reference numbers | Medium | Low | ⬜ Pending |
| Shoot status missing | Medium | Low | ⬜ Pending |
| Client duplicate prevention | Medium | Low | ⬜ Pending |
| Crew availability | Low | High | ⬜ Pending |
| Booking events | Low | Medium | ⬜ Pending |

---

## Schema Comparison

### Side-by-Side Analysis

| Aspect | Lumen | W-Tales | Decision |
|--------|-------------|---------|----------|
| **ID Strategy** | UUIDv7 (`varchar(255)`) | `text` for auth, `serial` for domain | Use UUIDv7 for all |
| **Timestamp TZ** | No timezone | Mixed | Standardize: withTimezone |
| **Auth Tables** | Full (with 2FA) | Basic | Keep Lumen |
| **Org Tables** | organizations, members, invitations | Same + activityLogs | Merge |
| **SaaS Billing** | purchases, webhookEvents | None | Keep Lumen |
| **Domain Tables** | None | 25+ tables | Add with improvements |

### Tables Inventory

#### Keep from Lumen (8 tables)
```
✅ users (enhanced)
✅ sessions
✅ accounts
✅ verifications
✅ twoFactors
✅ organizations
✅ members
✅ invitations
✅ purchases
✅ webhookEvents
```

#### Add from W-Tales (25+ tables)
```
📦 configurations
👥 clients
📅 bookings, bookingParticipants, bookingEvents (new)
📸 shoots, shootsAssignments
👷 crews, crewAvailability (new), crewFeedbackSummary
📋 tasks, tasksAssignments
📦 deliverables, deliverablesAssignments
📝 assignmentSubmissions, submissionFiles, submissionFeedback, assignmentActivities
💰 receivedAmounts, paymentSchedules, expenses, expensesAssignments, invoices, invoiceLineItems
📎 attachments
🔔 notifications, activityLogs
💬 conversations, whatsappMessages (optional)
```

---

## Final Unified Schema Plan

### File Organization

```
packages/database/drizzle/schema/
├── index.ts                    # Re-exports all
├── enums.ts                    # All pgEnum definitions
├── auth.ts                     # users, sessions, accounts, verifications, twoFactors
├── organizations.ts            # organizations, members, invitations
├── billing.ts                  # purchases, webhookEvents
├── configurations.ts           # configurations
├── clients.ts                  # clients
├── bookings.ts                 # bookings, bookingParticipants, bookingEvents
├── shoots.ts                   # shoots, shootsAssignments
├── crews.ts                    # crews, crewAvailability, crewFeedbackSummary
├── tasks.ts                    # tasks, tasksAssignments
├── deliverables.ts             # deliverables, deliverablesAssignments
├── submissions.ts              # assignmentSubmissions, submissionFiles, submissionFeedback
├── finances.ts                 # receivedAmounts, paymentSchedules, expenses, invoices
├── attachments.ts              # attachments
├── notifications.ts            # notifications, activityLogs
└── messaging.ts                # conversations, whatsappMessages (optional)
```

### Status Fields Strategy: Hybrid Approach

Studio owners need flexibility to customize statuses (task status, crew status, shoot status) for their workflow. However, PostgreSQL enums are database-level and global - all organizations share the same values.

**Solution**: Use a **hybrid approach** that balances data integrity with customization.

#### Category 1: Hard-coded Enums (System-Critical)

These statuses have **business logic tied to them** - workflows, permissions, automations. They CANNOT be customized.

| Field | Table | Why Fixed |
|-------|-------|-----------|
| `status` | bookings | Phase transitions drive booking lifecycle |
| `workflowStatus` | tasks, deliverables | Submission workflow is system-defined |
| `status` | assignmentSubmissions | Review process is fixed |
| `status` | paymentSchedules | Financial calculations depend on it |
| `status` | invoices | Financial reporting depends on it |
| `paymentMethod` | receivedAmounts | Fixed set of payment types |
| `billTo` | expenses | Binary: studio or client |

#### Category 2: Configurable via `configurations` Table

These are **display/organizational statuses** that owners can customize per organization.

| Field | Table | What Owners Can Do |
|-------|-------|-------------------|
| `status` | tasks | Rename "todo" to "backlog", add "on_hold" |
| `priority` | tasks, deliverables | Add "critical", rename "high" to "important" |
| `status` | deliverables | Customize delivery workflow labels |
| `status` | crews | Add "on_vacation", "part_time" |
| `status` | shoots | Add "rescheduled", rename labels |

#### How It Works

**1. Domain tables store TEXT (not enum)**
```typescript
// tasks table
status: text("status").notNull().default("todo"),     // Validated against configurations
priority: text("priority").notNull().default("medium"),
workflowStatus: workflowStatusEnum("workflow_status"), // This stays as enum (system-critical)
```

**2. Configurations table defines valid values per organization**
```typescript
// Each organization has their own set of valid statuses
{ organizationId: "org_1", type: "task_status", key: "todo", label: "To Do", color: "#6B7280" }
{ organizationId: "org_1", type: "task_status", key: "in_progress", label: "In Progress", color: "#3B82F6" }
{ organizationId: "org_1", type: "task_status", key: "on_hold", label: "On Hold", color: "#F59E0B" } // Custom!
```

**3. API validates against configurations**
```typescript
async function updateTaskStatus(taskId: string, newStatus: string, orgId: string) {
  const validStatus = await db.query.configurations.findFirst({
    where: and(
      eq(configurations.organizationId, orgId),
      eq(configurations.type, "task_status"),
      eq(configurations.key, newStatus)
    )
  });
  
  if (!validStatus) throw new Error(`Invalid status: ${newStatus}`);
  
  await db.update(tasks).set({ status: newStatus }).where(eq(tasks.id, taskId));
}
```

**4. Default configurations seeded on organization creation**
```typescript
const defaultTaskStatuses = [
  { key: "todo", label: "To Do", color: "#6B7280", sortOrder: 1, isDefault: true, isSystem: true },
  { key: "in_progress", label: "In Progress", color: "#3B82F6", sortOrder: 2, isSystem: true },
  { key: "in_review", label: "In Review", color: "#F59E0B", sortOrder: 3, isSystem: true },
  { key: "completed", label: "Completed", color: "#10B981", sortOrder: 4, isSystem: true },
];
// isSystem: true means it can't be deleted (but can be renamed)
```

---

### Enum Definitions (System-Critical Only)

```typescript
// enums.ts - Only enums that CANNOT be customized by owners

// Booking Phase - drives lifecycle transitions
export const bookingPhaseEnum = pgEnum("booking_phase", [
  "new", "preparation", "shooting", "delivery", "completed", "cancelled"
]);

// Workflow Status - drives submission/review process
export const workflowStatusEnum = pgEnum("workflow_status", [
  "not_started", "assigned", "submitted", "in_review", "revision_requested", "approved"
]);

// Submission Status - drives review workflow
export const submissionStatusEnum = pgEnum("submission_status", [
  "draft", "submitted", "in_review", "approved", "rejected", "revision_requested"
]);

// Financial - must be consistent for calculations
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash", "upi", "bank_transfer", "cheque", "card", "other"
]);

export const paymentScheduleStatusEnum = pgEnum("payment_schedule_status", [
  "pending", "partial", "completed", "overdue", "cancelled"
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft", "sent", "paid", "partial", "overdue", "cancelled"
]);

export const billToEnum = pgEnum("bill_to", [
  "studio", "client"
]);

// Configuration Types - defines what can be configured
export const configTypeEnum = pgEnum("config_type", [
  "task_status",
  "task_priority", 
  "deliverable_status",
  "deliverable_priority",
  "crew_status",
  "shoot_status",
  "booking_type",
  "package_type",
  "relation_type",
  "expense_category"
]);

// Messaging (Optional)
export const conversationStatusEnum = pgEnum("conversation_status", [
  "active", "archived", "blocked"
]);

export const participantTypeEnum = pgEnum("participant_type", [
  "crew", "client"
]);

export const messageDirectionEnum = pgEnum("message_direction", [
  "inbound", "outbound"
]);

export const messageTypeEnum = pgEnum("message_type", [
  "text", "image", "document", "audio", "video"
]);

export const messageStatusEnum = pgEnum("message_status", [
  "sent", "delivered", "read", "failed"
]);

// SaaS Billing (from Lumen)
export const purchaseTypeEnum = pgEnum("purchase_type", [
  "SUBSCRIPTION", "ONE_TIME"
]);
```

### Configurations Table (Enhanced)

```typescript
export const configurations = pgTable("configurations", {
  id: varchar("id", { length: 255 }).$defaultFn(() => uuidv7()).primaryKey(),
  organizationId: varchar("organization_id", { length: 255 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  
  type: configTypeEnum("type").notNull(),
  key: varchar("key", { length: 100 }).notNull(),      // Internal key: "todo", "in_progress"
  label: text("label").notNull(),                       // Display label: "To Do", "In Progress"
  
  // UI Customization
  color: varchar("color", { length: 20 }),              // Hex color: "#3B82F6"
  icon: varchar("icon", { length: 50 }),                // Icon name: "circle", "clock"
  sortOrder: integer("sort_order").default(0),          // For ordering in UI dropdowns
  
  // System flags
  isDefault: boolean("is_default").default(false),      // Default value for new items
  isSystem: boolean("is_system").default(false),        // Can't be deleted, only renamed
  
  // Additional config
  metadata: jsonb("metadata"),                          // Extra config: { allowTransitionTo: [...] }
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex("configurations_org_type_key_idx").on(
    table.organizationId, 
    table.type, 
    table.key
  ),
  index("configurations_org_type_idx").on(table.organizationId, table.type),
]);
```

### Status Field Summary

| Field | Storage | Customizable | Why |
|-------|---------|--------------|-----|
| `bookings.status` | **Enum** | ❌ No | Phase transitions have business rules |
| `tasks.status` | **Text** | ✅ Yes | Owners want custom labels |
| `tasks.priority` | **Text** | ✅ Yes | Owners want custom priorities |
| `tasks.workflowStatus` | **Enum** | ❌ No | Submission workflow is fixed |
| `deliverables.status` | **Text** | ✅ Yes | Owners want custom labels |
| `deliverables.priority` | **Text** | ✅ Yes | Owners want custom priorities |
| `shoots.status` | **Text** | ✅ Yes | Owners want custom labels |
| `crews.status` | **Text** | ✅ Yes | Owners want custom labels |
| `paymentSchedules.status` | **Enum** | ❌ No | Financial logic depends on it |
| `invoices.status` | **Enum** | ❌ No | Financial logic depends on it |
| `receivedAmounts.paymentMethod` | **Enum** | ❌ No | Fixed set (UPI, cash, etc.) |

### Key Table Definitions (Improved)

#### bookings.ts
```typescript
export const bookings = pgTable("bookings", {
  id: varchar("id", { length: 255 }).$defaultFn(() => uuidv7()).primaryKey(),
  organizationId: varchar("organization_id", { length: 255 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  
  // Identification
  referenceNumber: varchar("reference_number", { length: 50 }).notNull(),
  name: text("name").notNull(),
  
  // Type & Package
  bookingType: text("booking_type").notNull(),
  packageType: text("package_type").notNull(),
  packageCost: decimal("package_cost", { precision: 12, scale: 2 }).notNull(),
  
  // Status
  status: bookingPhaseEnum("status").notNull().default("new"),
  
  // Financial Cache (updated via triggers/app logic)
  totalReceived: decimal("total_received", { precision: 12, scale: 2 }).default("0"),
  totalExpenses: decimal("total_expenses", { precision: 12, scale: 2 }).default("0"),
  
  // Details
  note: text("note"),
  
  // Audit
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  updatedBy: varchar("updated_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  
  // Soft Delete
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: varchar("deleted_by", { length: 255 }).references(() => users.id),
}, (table) => [
  uniqueIndex("bookings_org_ref_idx").on(table.organizationId, table.referenceNumber),
  index("bookings_org_status_idx").on(table.organizationId, table.status),
  index("bookings_org_created_idx").on(table.organizationId, table.createdAt),
]);
```

#### shoots.ts
```typescript
export const shoots = pgTable("shoots", {
  id: varchar("id", { length: 255 }).$defaultFn(() => uuidv7()).primaryKey(),
  bookingId: varchar("booking_id", { length: 255 })
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id", { length: 255 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  
  // Details
  title: text("title").notNull(),
  status: text("status").notNull().default("scheduled"), // TEXT - validated against configurations
  
  // Schedule (FIXED: proper types)
  date: date("date"),
  startTime: time("start_time"),
  endTime: time("end_time"),
  reportingTime: time("reporting_time"),
  durationMinutes: integer("duration_minutes"),
  
  // Location
  location: jsonb("location"), // { name, address, lat, lng, notes }
  
  // Additional
  notes: text("notes"),
  additionalDetails: jsonb("additional_details"),
  
  // Audit
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  updatedBy: varchar("updated_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("shoots_org_date_idx").on(table.organizationId, table.date),
  index("shoots_booking_idx").on(table.bookingId),
  index("shoots_status_idx").on(table.organizationId, table.status),
]);
```

#### tasks.ts
```typescript
export const tasks = pgTable("tasks", {
  id: varchar("id", { length: 255 }).$defaultFn(() => uuidv7()).primaryKey(),
  bookingId: varchar("booking_id", { length: 255 })
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id", { length: 255 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  deliverableId: varchar("deliverable_id", { length: 255 })
    .references(() => deliverables.id, { onDelete: "cascade" }),
  
  // Details
  description: text("description").notNull(),
  status: text("status").notNull().default("todo"),           // TEXT - validated against configurations
  priority: text("priority").notNull().default("medium"),     // TEXT - validated against configurations
  workflowStatus: workflowStatusEnum("workflow_status"),      // ENUM - system-critical, not customizable
  
  // Schedule (FIXED: proper types)
  startDate: date("start_date"),
  dueDate: date("due_date"),
  
  // Approval
  approvedSubmissionId: varchar("approved_submission_id", { length: 255 }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  
  // Status Tracking
  lastStatusUpdateBy: varchar("last_status_update_by", { length: 255 }),
  lastStatusUpdatedAt: timestamp("last_status_updated_at", { withTimezone: true }),
  
  // Audit
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  updatedBy: varchar("updated_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("tasks_org_status_idx").on(table.organizationId, table.status),
  index("tasks_booking_idx").on(table.bookingId),
  index("tasks_deliverable_idx").on(table.deliverableId),
]);
```

#### finances.ts (receivedAmounts)
```typescript
export const receivedAmounts = pgTable("received_amounts", {
  id: varchar("id", { length: 255 }).$defaultFn(() => uuidv7()).primaryKey(),
  bookingId: varchar("booking_id", { length: 255 })
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  organizationId: varchar("organization_id", { length: 255 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  invoiceId: varchar("invoice_id", { length: 255 })
    .references(() => invoices.id, { onDelete: "set null" }),
  paymentScheduleId: varchar("payment_schedule_id", { length: 255 })
    .references(() => paymentSchedules.id, { onDelete: "set null" }),
  
  // Payment Details
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method"), // NEW
  transactionReference: text("transaction_reference"), // NEW
  description: text("description"),
  paidOn: date("paid_on"),
  
  // Audit
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("received_amounts_booking_idx").on(table.bookingId),
  index("received_amounts_org_date_idx").on(table.organizationId, table.paidOn),
]);
```

---

## Migration Phases

### Phase 1: Foundation (Week 1)
**Goal**: Set up database schema and core infrastructure

| Task | Description | Status |
|------|-------------|--------|
| 1.1 | Create enum definitions file | ⬜ |
| 1.2 | Update auth tables (keep Lumen) | ⬜ |
| 1.3 | Keep billing tables (Lumen) | ⬜ |
| 1.4 | Add configurations table | ⬜ |
| 1.5 | Add clients table | ⬜ |
| 1.6 | Add bookings + participants + events | ⬜ |
| 1.7 | Generate and test migration | ⬜ |

### Phase 2: Core Domain (Week 2)
**Goal**: Add shoots, crews, tasks, deliverables

| Task | Description | Status |
|------|-------------|--------|
| 2.1 | Add shoots + assignments | ⬜ |
| 2.2 | Add crews + availability + feedback | ⬜ |
| 2.3 | Add tasks + assignments | ⬜ |
| 2.4 | Add deliverables + assignments | ⬜ |
| 2.5 | Add submission workflow tables | ⬜ |
| 2.6 | Generate and test migration | ⬜ |

### Phase 3: Financial & Supporting (Week 3)
**Goal**: Add payments, expenses, attachments, notifications

| Task | Description | Status |
|------|-------------|--------|
| 3.1 | Add receivedAmounts (with improvements) | ⬜ |
| 3.2 | Add paymentSchedules | ⬜ |
| 3.3 | Add expenses + assignments | ⬜ |
| 3.4 | Add invoices + line items | ⬜ |
| 3.5 | Add attachments | ⬜ |
| 3.6 | Add notifications + activity logs | ⬜ |
| 3.7 | Add messaging tables (optional) | ⬜ |
| 3.8 | Generate and test migration | ⬜ |

### Phase 4: API Layer (Week 4-5)
**Goal**: Port API routes to oRPC

| Task | Description | Status |
|------|-------------|--------|
| 4.1 | Create configurations API module | ⬜ |
| 4.2 | Create clients API module | ⬜ |
| 4.3 | Create bookings API module | ⬜ |
| 4.4 | Create shoots API module | ⬜ |
| 4.5 | Create crews API module | ⬜ |
| 4.6 | Create tasks API module | ⬜ |
| 4.7 | Create deliverables API module | ⬜ |
| 4.8 | Create payments API module | ⬜ |
| 4.9 | Create expenses API module | ⬜ |

### Phase 5: Frontend (Week 6-8)
**Goal**: Port UI components and routes

| Task | Description | Status |
|------|-------------|--------|
| 5.1 | Create route structure | ⬜ |
| 5.2 | Port hooks (adapt to @repo/api) | ⬜ |
| 5.3 | Port components | ⬜ |
| 5.4 | Port dashboard & analytics | ⬜ |
| 5.5 | Implement RBAC in UI | ⬜ |

### Phase 6: Integrations (Week 9)
**Goal**: Port storage, email, messaging

| Task | Description | Status |
|------|-------------|--------|
| 6.1 | Extend storage package for attachments | ⬜ |
| 6.2 | Port email templates | ⬜ |
| 6.3 | Port WhatsApp integration (optional) | ⬜ |

### Phase 7: Testing & Polish (Week 10)
**Goal**: Ensure quality and completion

| Task | Description | Status |
|------|-------------|--------|
| 7.1 | Update Playwright E2E tests | ⬜ |
| 7.2 | Test all CRUD flows | ⬜ |
| 7.3 | Validate RBAC across roles | ⬜ |
| 7.4 | Performance testing | ⬜ |
| 7.5 | Final cleanup | ⬜ |

---

## Decisions Log

### Pending Decisions

| # | Decision | Options | Recommendation | Status |
|---|----------|---------|----------------|--------|
| 1 | WhatsApp Integration | Include / Defer | Defer to Phase 2 | ⬜ Pending |
| 2 | ID Strategy for Domain | UUIDv7 / Serial | UUIDv7 (consistency) | ⬜ Pending |
| 3 | Activity Logs | Enhanced / Simple | Enhanced (resource tracking) | ⬜ Pending |
| 4 | Package Templates | Structured / Text | Defer (use text initially) | ⬜ Pending |
| 5 | i18n | Keep / Remove | Keep (already in Lumen) | ⬜ Pending |
| 6 | User Billing vs Org Billing | Both / Org Only | Org Only (B2B focus) | ⬜ Pending |

### Approved Decisions

| # | Decision | Choice | Date | Notes |
|---|----------|--------|------|-------|
| 1 | Status Fields Strategy | Hybrid (Enum + Config) | 2024-12-18 | System-critical statuses use enums; customizable statuses use TEXT + configurations table |

---

## References

### Documentation
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [better-auth Docs](https://www.better-auth.com/)
- [oRPC Docs](https://orpc.unnoq.com/)
- [Next.js App Router](https://nextjs.org/docs/app)

### Repository Links
- Source: `/Users/rakesh/Developer/winter-arc/w-tales`
- Target: `/Users/rakesh/Developer/agency/studio-saas-monorepo`

### Key Files
- W-Tales Schema: `w-tales/src/lib/db/schema.ts`
- Lumen Schema: `studio-saas-monorepo/packages/database/drizzle/schema/postgres.ts`
- W-Tales Auth: `w-tales/src/lib/auth/index.ts`
- W-Tales Permissions: `w-tales/src/lib/auth/permission.ts`

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2024-12-18 | Added hybrid approach for status fields (enum + configurations); Updated table definitions to use TEXT for customizable statuses |
| 1.0 | 2024-12-18 | Initial document created |

---

*This document will be updated as decisions are made and migration progresses.*
