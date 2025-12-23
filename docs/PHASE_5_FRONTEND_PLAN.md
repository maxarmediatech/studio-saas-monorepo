# Phase 5: Frontend Migration Plan

> **Status**: Planning
> **Created**: 2024-12-19
> **Source**: W-Tales `/Users/rakesh/Developer/winter-arc/w-tales/src`
> **Target**: Lumen `/Users/rakesh/Developer/agency/studio-saas-monorepo/apps/web`

---

## Table of Contents

1. [Overview](#overview)
2. [Source Analysis Summary](#source-analysis-summary)
3. [Migration Strategy](#migration-strategy)
4. [Architecture Decisions](#architecture-decisions)
5. [Implementation Phases](#implementation-phases)
6. [File Migration Map](#file-migration-map)
7. [Component Patterns](#component-patterns)
8. [Hook Migration Guide](#hook-migration-guide)
9. [Route Structure](#route-structure)
10. [Implementation Checklist](#implementation-checklist)

---

## Overview

Phase 5 migrates the W-Tales frontend to the Lumen monorepo structure. The goal is to port all UI routes, components, hooks, and patterns while adapting them to use the new oRPC API layer created in Phase 4.

### Key Changes from W-Tales

| Aspect | W-Tales | Lumen |
|--------|---------|-------------|
| API Layer | Next.js API routes + fetch | oRPC procedures + client |
| Data Fetching | Custom hooks + fetch | oRPC client + React Query |
| Auth | better-auth (same) | better-auth (same) |
| Organization | Session-based | URL-based (`/app/[organizationSlug]`) |
| i18n | None | next-intl (keep) |
| Structure | Single app | Monorepo packages |

---

## Source Analysis Summary

### W-Tales Frontend Statistics

| Category | Count | Notes |
|----------|-------|-------|
| **Route Pages** | 25 | Dashboard routes under `(dashboard)/` |
| **Custom Hooks** | 66 | Data fetching, mutations, URL state, permissions |
| **UI Components** | 40+ | Radix UI + custom wrappers |
| **Data Table Components** | 8 | Advanced table system |
| **Form Components** | 10 | Field wrappers with validation |
| **Type Definitions** | 9 files | TypeScript interfaces |
| **API Routes** | 50+ | Being replaced by oRPC |

### Technology Stack (Preserved)

- **Framework**: Next.js 15+ with App Router
- **State**: React Query (TanStack Query v5)
- **URL State**: nuqs
- **Forms**: React Hook Form + Zod
- **Tables**: TanStack Table v8
- **UI**: Radix UI + Tailwind CSS + shadcn/ui
- **Auth**: better-auth

---

## Migration Strategy

### Approach: Incremental Feature Migration

We'll migrate feature-by-feature rather than all-at-once:

1. **Phase 5.0**: Shared infrastructure (hooks, utils, types)
2. **Phase 5.1**: Core layout and navigation
3. **Phase 5.2**: Dashboard and home
4. **Phase 5.3**: Configurations (simplest CRUD)
5. **Phase 5.4**: Clients module
6. **Phase 5.5**: Crews module
7. **Phase 5.6**: Bookings module (most complex)
8. **Phase 5.7**: Shoots module
9. **Phase 5.8**: Tasks module
10. **Phase 5.9**: Deliverables module
11. **Phase 5.10**: Payments module
12. **Phase 5.11**: Expenses module
13. **Phase 5.12**: Reviews/Submissions module
14. **Phase 5.13**: My Assignments (crew portal)
15. **Phase 5.14**: Settings pages

### Key Principle: Adapt, Don't Copy

- **Don't**: Copy W-Tales code verbatim
- **Do**: Adapt patterns to use oRPC client
- **Do**: Follow Lumen conventions where they exist
- **Do**: Improve patterns where W-Tales has issues

---

## Architecture Decisions

### 1. Route Structure

**Lumen Pattern** (URL-based org):
```
/app/[organizationSlug]/
├── dashboard/
├── bookings/
├── shoots/
└── ...
```

**W-Tales Pattern** (session-based org):
```
/(dashboard)/
├── dashboard/
├── bookings/
└── ...
```

**Decision**: Use Lumen's URL-based organization pattern. This is better for:
- Multi-tab workflows (different orgs in different tabs)
- Bookmarkable URLs
- SSR with org context

### 2. Data Fetching with oRPC

**W-Tales Pattern**:
```typescript
// Custom hook with fetch
export function useBookings() {
  return useQuery({
    queryKey: ["bookings", filters],
    queryFn: () => fetch("/api/bookings?" + params).then(r => r.json())
  });
}
```

**Lumen Pattern** (oRPC):
```typescript
// Using oRPC client
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { orpc } from "@/lib/orpc/react";

export function useBookings(filters: BookingFilters) {
  return useSuspenseQuery(
    orpc.bookings.list.queryOptions({ input: filters })
  );
}
```

**Decision**: Use oRPC client methods. Benefits:
- Type-safe end-to-end
- Automatic query key generation
- Built-in React Query integration

### 3. Mutation Pattern

**W-Tales Pattern**:
```typescript
export function useCreateBooking() {
  return useMutation({
    mutationFn: (data) => fetch("/api/bookings", {
      method: "POST",
      body: JSON.stringify(data)
    }).then(r => r.json())
  });
}
```

**Lumen Pattern**:
```typescript
export function useCreateBooking() {
  const utils = orpc.useUtils();

  return useMutation(
    orpc.bookings.create.mutationOptions({
      onSuccess: () => {
        utils.bookings.list.invalidate();
      }
    })
  );
}
```

### 4. Permission Checking

**W-Tales Pattern** (client hooks):
```typescript
export function useBookingPermissions() {
  const { session } = useSession();
  const role = session?.activeOrganization?.role;

  return {
    canCreate: hasPermission(role, "booking", "create"),
    canDelete: hasPermission(role, "booking", "delete"),
  };
}
```

**Lumen Pattern** (same, but with context):
```typescript
export function useBookingPermissions() {
  const { membership } = useStudioContext();

  return {
    canCreate: hasPermission(membership.role, "booking", "create"),
    canDelete: hasPermission(membership.role, "booking", "delete"),
  };
}
```

### 5. URL State (nuqs)

**Decision**: Keep nuqs pattern as-is. It works well for:
- Table filters/sorting/pagination
- Modal open/close state
- Tab navigation
- Shareable URLs

### 6. Form Handling

**Decision**: Keep React Hook Form + Zod pattern. Adapt schemas to match oRPC input types.

```typescript
// Schema should match oRPC input
import { createBookingInputSchema } from "@repo/api/modules/studio/schemas/booking";

const form = useForm({
  resolver: zodResolver(createBookingInputSchema),
});
```

---

## Implementation Phases

### Phase 5.0: Shared Infrastructure

**Goal**: Set up shared utilities, types, and base hooks

#### Files to Create

```
apps/web/
├── lib/
│   ├── orpc/
│   │   ├── client.ts           # oRPC client setup
│   │   └── react.ts            # React Query integration
│   ├── hooks/
│   │   ├── use-studio-context.ts   # Org/membership context
│   │   ├── use-data-table.ts       # Table state management
│   │   └── use-debounced-callback.ts
│   ├── utils/
│   │   ├── format.ts           # formatCurrency, formatDate
│   │   ├── cn.ts               # className utility
│   │   └── parsers.ts          # nuqs parsers
│   └── permissions/
│       ├── roles.ts            # Role definitions
│       └── hooks.ts            # Permission hooks
├── types/
│   ├── booking.ts
│   ├── shoot.ts
│   ├── task.ts
│   ├── deliverable.ts
│   ├── crew.ts
│   ├── client.ts
│   ├── payment.ts
│   ├── expense.ts
│   └── data-table.ts
└── components/
    ├── data-table/             # Port from W-Tales
    │   ├── data-table.tsx
    │   ├── data-table-toolbar.tsx
    │   ├── data-table-pagination.tsx
    │   ├── data-table-faceted-filter.tsx
    │   ├── data-table-date-filter.tsx
    │   └── data-table-view-options.tsx
    └── form/                   # Port from W-Tales
        ├── text-field.tsx
        ├── select-field.tsx
        ├── date-field.tsx
        ├── price-field.tsx
        └── submit-button.tsx
```

#### Key Tasks

- [ ] Set up oRPC client with React Query
- [ ] Create studio context provider (org, membership, permissions)
- [ ] Port `useDataTable` hook (complex - handles filtering, sorting, pagination)
- [ ] Port data table components
- [ ] Port form field components
- [ ] Set up nuqs parsers
- [ ] Port utility functions
- [ ] Create type definitions (can import from @repo/api where possible)

---

### Phase 5.1: Core Layout & Navigation

**Goal**: Set up the app shell, sidebar, and navigation

#### Files to Create

```
apps/web/app/(saas)/app/[organizationSlug]/
├── layout.tsx                  # Studio layout with sidebar
├── _components/
│   ├── studio-sidebar.tsx      # Main navigation sidebar
│   ├── studio-header.tsx       # Top header with user menu
│   ├── org-switcher.tsx        # Organization dropdown
│   └── nav-items.tsx           # Navigation items with permissions
└── providers.tsx               # Studio-specific providers
```

#### Navigation Items

```typescript
const studioNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: null },
  { href: "/bookings", label: "Bookings", icon: CalendarDays, permission: "booking:read" },
  { href: "/shoots", label: "Shoots", icon: Camera, permission: "shoot:read" },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, permission: "task:read" },
  { href: "/deliverables", label: "Deliverables", icon: Package, permission: "deliverable:read" },
  { href: "/expenses", label: "Expenses", icon: Receipt, permission: "expense:read" },
  { href: "/payments", label: "Payments", icon: CreditCard, permission: "payment:read" },
  { href: "/reviews", label: "Reviews", icon: ClipboardCheck, permission: "review:list" },
  { href: "/clients", label: "Clients", icon: Users, permission: "client:read" },
  { href: "/crews", label: "Crews", icon: HardHat, permission: "crew:read" },
  { href: "/configurations", label: "Settings", icon: Settings, permission: "configuration:read" },
];
```

---

### Phase 5.2: Dashboard

**Goal**: Port dashboard with KPIs, charts, and quick actions

#### Files to Create

```
apps/web/app/(saas)/app/[organizationSlug]/dashboard/
├── page.tsx                    # Server component with prefetch
├── _components/
│   ├── dashboard-content.tsx   # Client component
│   ├── financial-summary.tsx   # Revenue, expenses, profit cards
│   ├── booking-summary.tsx     # Booking stats by phase
│   ├── operations-summary.tsx  # Shoots, tasks, deliverables
│   ├── quick-actions.tsx       # Action items requiring attention
│   ├── upcoming-shoots.tsx     # Next shoots list
│   └── recent-bookings.tsx     # Recent bookings list
└── _hooks/
    └── use-dashboard.ts        # Dashboard data hook
```

#### Data Hooks

```typescript
// use-dashboard.ts
export function useDashboard(dateRange?: { start: string; end: string }) {
  return useSuspenseQuery(
    orpc.dashboard.get.queryOptions({
      input: { dateRange }
    })
  );
}

export function useQuickActions(limit = 10) {
  return useSuspenseQuery(
    orpc.dashboard.actions.queryOptions({
      input: { limit }
    })
  );
}
```

---

### Phase 5.3: Configurations Module

**Goal**: Simplest CRUD module - good starting point

#### Files to Create

```
apps/web/app/(saas)/app/[organizationSlug]/configurations/
├── page.tsx                    # Configuration types list
├── layout.tsx                  # Tabs layout
├── [type]/
│   └── page.tsx                # Specific config type list
├── _components/
│   ├── config-table.tsx
│   ├── config-columns.tsx
│   ├── config-form.tsx
│   ├── create-config-sheet.tsx
│   └── edit-config-sheet.tsx
└── _hooks/
    ├── use-configurations.ts
    └── use-config-mutation.ts
```

#### Configuration Types (Tabs)

- Booking Types
- Package Types
- Task Status
- Task Priority
- Deliverable Status
- Deliverable Priority
- Crew Status
- Shoot Status
- Expense Categories

---

### Phase 5.4: Clients Module

**Goal**: Simple list/detail CRUD

#### Files to Create

```
apps/web/app/(saas)/app/[organizationSlug]/clients/
├── page.tsx
├── [id]/
│   └── page.tsx                # Client detail (bookings history)
├── _components/
│   ├── clients-table.tsx
│   ├── clients-columns.tsx
│   ├── clients-toolbar.tsx
│   ├── client-form.tsx
│   ├── create-client-sheet.tsx
│   └── edit-client-sheet.tsx
└── _hooks/
    ├── use-clients.ts
    ├── use-client.ts
    ├── use-client-mutation.ts
    └── use-client-params.ts
```

---

### Phase 5.5: Crews Module

**Goal**: Crew management with availability

#### Files to Create

```
apps/web/app/(saas)/app/[organizationSlug]/crews/
├── page.tsx
├── [id]/
│   └── page.tsx                # Crew detail with assignments
├── _components/
│   ├── crews-table.tsx
│   ├── crews-columns.tsx
│   ├── crew-form.tsx
│   ├── crew-availability.tsx   # Availability calendar
│   ├── create-crew-sheet.tsx
│   ├── edit-crew-sheet.tsx
│   └── create-from-member-dialog.tsx
└── _hooks/
    ├── use-crews.ts
    ├── use-crew.ts
    ├── use-crew-availability.ts
    ├── use-crew-mutation.ts
    └── use-crew-params.ts
```

---

### Phase 5.6: Bookings Module (Complex)

**Goal**: Most complex module - multi-tab forms, nested tables

#### Files to Create

```
apps/web/app/(saas)/app/[organizationSlug]/bookings/
├── page.tsx                    # Bookings list
├── add/
│   └── page.tsx                # Create booking (multi-tab form)
├── [id]/
│   ├── page.tsx                # Booking detail
│   └── edit/
│       └── page.tsx            # Edit booking
├── _components/
│   ├── bookings-table/
│   │   ├── bookings-table.tsx
│   │   ├── bookings-columns.tsx
│   │   ├── bookings-toolbar.tsx
│   │   ├── booking-row-expanded.tsx  # Nested shoots/tasks tables
│   │   └── booking-actions.tsx
│   ├── booking-form/
│   │   ├── booking-form.tsx          # Main form wrapper
│   │   ├── booking-form-schema.ts    # Zod schema
│   │   ├── booking-details-tab.tsx   # Basic details
│   │   ├── booking-participants-tab.tsx
│   │   ├── booking-shoots-tab.tsx    # Shoots inline form
│   │   ├── booking-payments-tab.tsx  # Payment schedule
│   │   ├── booking-deliverables-tab.tsx
│   │   └── booking-notes-tab.tsx
│   ├── booking-detail/
│   │   ├── booking-header.tsx
│   │   ├── booking-info-card.tsx
│   │   ├── booking-financials.tsx
│   │   ├── booking-shoots-card.tsx
│   │   ├── booking-tasks-card.tsx
│   │   ├── booking-deliverables-card.tsx
│   │   └── booking-timeline.tsx
│   └── booking-sheets/
│       ├── edit-booking-sheet.tsx
│       └── update-status-dialog.tsx
└── _hooks/
    ├── use-bookings.ts
    ├── use-booking.ts
    ├── use-booking-mutation.ts
    ├── use-booking-form.ts       # Complex form logic
    ├── use-booking-params.ts
    └── use-booking-permissions.ts
```

---

### Phase 5.7: Shoots Module

#### Files to Create

```
apps/web/app/(saas)/app/[organizationSlug]/shoots/
├── page.tsx
├── [id]/
│   └── page.tsx
├── _components/
│   ├── shoots-table/
│   │   ├── shoots-table.tsx
│   │   ├── shoots-columns.tsx
│   │   └── shoots-toolbar.tsx
│   ├── shoot-form/
│   │   ├── shoot-form.tsx
│   │   └── shoot-form-schema.ts
│   ├── shoot-detail/
│   │   ├── shoot-header.tsx
│   │   ├── shoot-info.tsx
│   │   └── shoot-crew-assignments.tsx
│   ├── crew-assignment/
│   │   ├── assign-crew-dialog.tsx
│   │   └── crew-assignment-list.tsx
│   └── shoot-sheets/
│       ├── create-shoot-sheet.tsx
│       └── edit-shoot-sheet.tsx
└── _hooks/
    ├── use-shoots.ts
    ├── use-shoot.ts
    ├── use-shoot-mutation.ts
    ├── use-shoot-params.ts
    └── use-shoot-permissions.ts
```

---

### Phase 5.8: Tasks Module

#### Files to Create

```
apps/web/app/(saas)/app/[organizationSlug]/tasks/
├── page.tsx
├── [id]/
│   └── page.tsx
├── _components/
│   ├── tasks-table/
│   │   ├── tasks-table.tsx
│   │   ├── tasks-columns.tsx
│   │   └── tasks-toolbar.tsx
│   ├── task-form/
│   │   ├── task-form.tsx
│   │   └── task-form-schema.ts
│   ├── task-detail/
│   │   ├── task-header.tsx
│   │   ├── task-info.tsx
│   │   ├── task-assignments.tsx
│   │   └── task-submissions.tsx
│   ├── task-workflow/
│   │   ├── update-status-dialog.tsx
│   │   └── submit-work-dialog.tsx
│   └── task-sheets/
│       ├── create-task-sheet.tsx
│       └── edit-task-sheet.tsx
└── _hooks/
    ├── use-tasks.ts
    ├── use-task.ts
    ├── use-task-mutation.ts
    ├── use-task-params.ts
    └── use-task-permissions.ts
```

---

### Phase 5.9: Deliverables Module

Similar structure to Tasks with additional:
- Convert to Task functionality
- Delivery workflow

---

### Phase 5.10: Payments Module

#### Files to Create

```
apps/web/app/(saas)/app/[organizationSlug]/payments/
├── page.tsx                    # Redirect to received
├── received/
│   └── page.tsx                # Received payments list
├── scheduled/
│   └── page.tsx                # Payment schedules list
├── _components/
│   ├── received/
│   │   ├── received-table.tsx
│   │   ├── received-columns.tsx
│   │   ├── received-form.tsx
│   │   └── received-sheet.tsx
│   ├── schedules/
│   │   ├── schedules-table.tsx
│   │   ├── schedules-columns.tsx
│   │   ├── schedule-form.tsx
│   │   ├── schedule-sheet.tsx
│   │   └── convert-to-received-dialog.tsx
│   └── payment-stats.tsx
└── _hooks/
    ├── use-received-payments.ts
    ├── use-payment-schedules.ts
    ├── use-payment-mutation.ts
    └── use-payment-params.ts
```

---

### Phase 5.11: Expenses Module

Standard CRUD with expense categories and assignment to booking/shoot/crew.

---

### Phase 5.12: Reviews/Submissions Module

#### Files to Create

```
apps/web/app/(saas)/app/[organizationSlug]/reviews/
├── page.tsx                    # Submission queue
├── [id]/
│   └── page.tsx                # Submission detail with review UI
├── _components/
│   ├── submissions-table.tsx
│   ├── submissions-columns.tsx
│   ├── submission-detail.tsx
│   ├── submission-files.tsx
│   ├── review-form.tsx
│   └── claim-button.tsx
└── _hooks/
    ├── use-submissions.ts
    ├── use-submission.ts
    └── use-submission-mutation.ts
```

---

### Phase 5.13: My Assignments (Crew Portal)

#### Files to Create

```
apps/web/app/(saas)/app/[organizationSlug]/my-assignments/
├── page.tsx                    # Overview dashboard
├── shoots/
│   └── page.tsx                # My shoot assignments
├── tasks/
│   └── page.tsx                # My task assignments
├── deliverables/
│   └── page.tsx                # My deliverable assignments
├── _components/
│   ├── assignment-summary.tsx
│   ├── my-shoots-list.tsx
│   ├── my-tasks-list.tsx
│   ├── my-deliverables-list.tsx
│   ├── submit-work-form.tsx
│   └── urgent-items.tsx
└── _hooks/
    ├── use-my-assignments.ts
    ├── use-my-shoots.ts
    ├── use-my-tasks.ts
    └── use-my-deliverables.ts
```

---

### Phase 5.14: Settings Pages

#### Files to Create

```
apps/web/app/(saas)/app/[organizationSlug]/settings/
├── page.tsx                    # Redirect to profile
├── profile/
│   └── page.tsx
├── organization/
│   └── page.tsx
├── team/
│   └── page.tsx                # Members & invitations
├── billing/
│   └── page.tsx
└── _components/
    ├── profile-form.tsx
    ├── organization-form.tsx
    ├── team-members-table.tsx
    ├── invite-member-dialog.tsx
    └── billing-info.tsx
```

---

## File Migration Map

### Hooks to Port (66 total)

| W-Tales Hook | Target Location | Adaptation Needed |
|--------------|-----------------|-------------------|
| `use-bookings.ts` | `bookings/_hooks/` | Use oRPC client |
| `use-booking-mutation.ts` | `bookings/_hooks/` | Use oRPC mutations |
| `use-booking-form.tsx` | `bookings/_hooks/` | Keep logic, update types |
| `use-booking-params.ts` | `bookings/_hooks/` | Minimal changes |
| `use-booking-permissions.ts` | `bookings/_hooks/` | Use studio context |
| `use-data-table.ts` | `lib/hooks/` | Shared, minimal changes |
| `use-debounced-callback.ts` | `lib/hooks/` | No changes |
| ... (similar for all modules) | | |

### Components to Port

| Category | W-Tales Location | Target Location |
|----------|------------------|-----------------|
| Data Table | `components/data-table/` | `components/data-table/` |
| Form Fields | `components/form/` | `components/form/` |
| UI Components | `components/ui/` | Use existing shadcn |
| Skeletons | `components/skeletons/` | `components/skeletons/` |

### Types to Port

| W-Tales File | Target | Notes |
|--------------|--------|-------|
| `types/booking.ts` | `types/booking.ts` | Align with API types |
| `types/shoot.ts` | `types/shoot.ts` | |
| `types/task.ts` | `types/task.ts` | |
| `types/deliverable.ts` | `types/deliverable.ts` | |
| `types/crew.ts` | `types/crew.ts` | |
| `types/payments.ts` | `types/payment.ts` | |
| `types/submission.ts` | `types/submission.ts` | |
| `types/data-table.ts` | `types/data-table.ts` | |
| `types/auth.ts` | Use @repo/auth types | |

---

## Component Patterns

### 1. List Page Pattern

```typescript
// page.tsx (Server Component)
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/orpc/server";
import { BookingsContent } from "./_components/bookings-content";

export default async function BookingsPage() {
  const queryClient = createQueryClient();

  // Prefetch on server
  await queryClient.prefetchQuery(
    orpc.bookings.list.queryOptions({ input: { page: 1, limit: 20 } })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BookingsContent />
    </HydrationBoundary>
  );
}

// _components/bookings-content.tsx (Client Component)
"use client";

export function BookingsContent() {
  const [params, setParams] = useBookingParams();
  const { data } = useBookings(params);
  const { canCreate } = useBookingPermissions();

  return (
    <div>
      <PageHeader title="Bookings">
        {canCreate && <CreateBookingButton />}
      </PageHeader>
      <BookingsTable data={data} />
    </div>
  );
}
```

### 2. Detail Page Pattern

```typescript
// [id]/page.tsx
export default async function BookingDetailPage({
  params
}: {
  params: { id: string; organizationSlug: string }
}) {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery(
    orpc.bookings.get.queryOptions({ input: { id: params.id } })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BookingDetail id={params.id} />
    </HydrationBoundary>
  );
}
```

### 3. Form Pattern

```typescript
// _components/booking-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBookingInputSchema } from "@repo/api/modules/studio/schemas/booking";

export function BookingForm({ onSuccess }: { onSuccess?: () => void }) {
  const createBooking = useCreateBooking();

  const form = useForm({
    resolver: zodResolver(createBookingInputSchema),
    defaultValues: {
      name: "",
      bookingType: "",
      packageType: "",
      packageCost: "0.00",
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await createBooking.mutateAsync(data);
    onSuccess?.();
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        {/* Form fields */}
      </form>
    </Form>
  );
}
```

### 4. Sheet/Modal Pattern

```typescript
// Global sheets registry
// _components/global-sheets.tsx
"use client";

import { useQueryState, parseAsString } from "nuqs";

export function GlobalSheets() {
  const [createBookingOpen] = useQueryState("createBooking", parseAsString);
  const [editBookingId] = useQueryState("editBooking", parseAsString);

  return (
    <>
      <CreateBookingSheet open={!!createBookingOpen} />
      <EditBookingSheet bookingId={editBookingId} />
      {/* Other sheets */}
    </>
  );
}

// Usage in components
function CreateBookingButton() {
  const [, setOpen] = useQueryState("createBooking", parseAsString);

  return (
    <Button onClick={() => setOpen("true")}>
      New Booking
    </Button>
  );
}
```

---

## Hook Migration Guide

### Data Fetching Hook Template

```typescript
// Before (W-Tales)
export function useBookings() {
  const searchParams = useSearchParams();

  return useQuery({
    queryKey: ["bookings", "list", searchParams.toString()],
    queryFn: async () => {
      const response = await fetch(`/api/bookings?${searchParams}`);
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
  });
}

// After (Lumen)
export function useBookings(filters: ListBookingsInput) {
  return useSuspenseQuery(
    orpc.bookings.list.queryOptions({ input: filters })
  );
}
```

### Mutation Hook Template

```typescript
// Before (W-Tales)
export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBookingInput) => {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Booking created");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// After (Lumen)
export function useCreateBooking() {
  const utils = orpc.useUtils();

  return useMutation(
    orpc.bookings.create.mutationOptions({
      onSuccess: (data) => {
        utils.bookings.list.invalidate();
        utils.bookings.stats.invalidate();
        toast.success(data.message);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );
}
```

---

## Implementation Checklist

### Phase 5.0: Shared Infrastructure
- [ ] Set up oRPC client (`lib/orpc/client.ts`)
- [ ] Set up oRPC React integration (`lib/orpc/react.ts`)
- [ ] Create studio context provider
- [ ] Port `useDataTable` hook
- [ ] Port data table components (8 files)
- [ ] Port form field components (10 files)
- [ ] Port utility functions
- [ ] Set up nuqs parsers
- [ ] Create shared type definitions

### Phase 5.1: Core Layout
- [ ] Create studio layout
- [ ] Create sidebar navigation
- [ ] Create header with org switcher
- [ ] Implement permission-based nav items
- [ ] Create global sheets registry

### Phase 5.2: Dashboard
- [ ] Create dashboard page
- [ ] Port financial summary component
- [ ] Port booking summary component
- [ ] Port operations summary component
- [ ] Port quick actions component
- [ ] Port upcoming shoots component
- [ ] Create dashboard hooks

### Phase 5.3: Configurations
- [ ] Create configurations layout with tabs
- [ ] Create config table
- [ ] Create config form
- [ ] Create CRUD sheets
- [ ] Create hooks

### Phase 5.4: Clients
- [ ] Create clients list page
- [ ] Create client detail page
- [ ] Port table and columns
- [ ] Port form and sheets
- [ ] Create hooks

### Phase 5.5: Crews
- [ ] Create crews list page
- [ ] Create crew detail page
- [ ] Port availability component
- [ ] Port table and columns
- [ ] Port form and sheets
- [ ] Create hooks

### Phase 5.6: Bookings (Complex)
- [ ] Create bookings list page
- [ ] Create booking detail page
- [ ] Create add booking page
- [ ] Port multi-tab form
- [ ] Port expandable row tables
- [ ] Port all form tabs
- [ ] Port detail components
- [ ] Create all hooks

### Phase 5.7: Shoots
- [ ] Create list and detail pages
- [ ] Port table and columns
- [ ] Port crew assignment components
- [ ] Create hooks

### Phase 5.8: Tasks
- [ ] Create list and detail pages
- [ ] Port table and columns
- [ ] Port workflow components
- [ ] Port submission components
- [ ] Create hooks

### Phase 5.9: Deliverables
- [ ] Create list and detail pages
- [ ] Port table and columns
- [ ] Port convert-to-task functionality
- [ ] Create hooks

### Phase 5.10: Payments
- [ ] Create received payments page
- [ ] Create scheduled payments page
- [ ] Port tables and forms
- [ ] Port convert schedule functionality
- [ ] Create hooks

### Phase 5.11: Expenses
- [ ] Create list and detail pages
- [ ] Port table and form
- [ ] Create hooks

### Phase 5.12: Reviews
- [ ] Create submissions queue page
- [ ] Create submission detail page
- [ ] Port review workflow UI
- [ ] Create hooks

### Phase 5.13: My Assignments
- [ ] Create overview page
- [ ] Create my shoots page
- [ ] Create my tasks page
- [ ] Create my deliverables page
- [ ] Port submit work functionality
- [ ] Create hooks

### Phase 5.14: Settings
- [ ] Create profile settings page
- [ ] Create organization settings page
- [ ] Create team management page
- [ ] Create billing page
- [ ] Port forms

---

## File Count Summary

| Phase | Components | Hooks | Pages | Total |
|-------|------------|-------|-------|-------|
| 5.0 Shared | 18 | 3 | 0 | 21 |
| 5.1 Layout | 5 | 1 | 1 | 7 |
| 5.2 Dashboard | 7 | 2 | 1 | 10 |
| 5.3 Configurations | 5 | 2 | 2 | 9 |
| 5.4 Clients | 6 | 4 | 2 | 12 |
| 5.5 Crews | 8 | 5 | 2 | 15 |
| 5.6 Bookings | 20 | 6 | 4 | 30 |
| 5.7 Shoots | 10 | 5 | 2 | 17 |
| 5.8 Tasks | 12 | 5 | 2 | 19 |
| 5.9 Deliverables | 12 | 5 | 2 | 19 |
| 5.10 Payments | 12 | 4 | 3 | 19 |
| 5.11 Expenses | 6 | 4 | 2 | 12 |
| 5.12 Reviews | 6 | 3 | 2 | 11 |
| 5.13 My Assignments | 8 | 4 | 4 | 16 |
| 5.14 Settings | 6 | 2 | 5 | 13 |
| **Total** | **141** | **55** | **34** | **230** |

---

## Next Steps

1. Review and approve this plan
2. Start with Phase 5.0 (Shared Infrastructure)
3. Each phase must be functional before moving to next
4. Test with real data after each module

---

*This document will be updated as implementation progresses.*
