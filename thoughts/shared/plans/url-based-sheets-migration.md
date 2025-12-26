# URL-Based Sheets Migration Plan

## Overview

Port the URL-based sheet pattern from `w-tales` to `studio-saas-monorepo` for better UX (bookmarkable, shareable, back-button support).

**Last Updated:** 2025-12-27

---

## Current State Comparison

| Aspect | w-tales | studio-saas-monorepo |
|--------|---------|---------------------|
| **State Management** | NUQS (URL params) | useState (local) |
| **Architecture** | GlobalSheets registry | Per-page dialogs |
| **Total Sheets** | 41 components | 3 dialogs |
| **Triggering** | `setParams({ createX: true })` | `setDialogOpen(true)` |
| **Back Button** | Closes sheet | Navigates away |
| **Deep Linking** | ✅ Supported | ❌ Not possible |
| **NUQS Installed** | ✅ Yes | ✅ Yes |
| **Foundation Started** | N/A | ✅ GlobalSheets + useClientParams |

---

## What's Already Done

1. **Foundation created:**
   - `GlobalSheets` component in `components/global-sheets.tsx` (empty registry, ready for sheets)
   - `useClientParams` hook in `hooks/params/use-client-params.ts` (with convenience methods)
   - `GlobalSheets` integrated into `StudioLayoutClient.tsx`

2. **Current dialogs to migrate:**
   - `ClientFormDialog.tsx` - 255 lines (handles create + edit)
   - `CrewFormDialog.tsx` - 328 lines (handles create + edit)
   - `ConfigurationFormDialog.tsx` - 322 lines (handles create + edit, reused for multiple config types)

---

## Implementation Phases

### Phase 1: Client Sheets (Pilot) ⬅️ START HERE
**Risk: Low | Files: 4 new, 1 modified, 1 deleted**

Convert `ClientFormDialog` → separate Create/Edit sheets.

**Files to create:**
```
apps/web/modules/saas/studio/components/clients/
├── sheets/
│   ├── ClientCreateSheet.tsx    # Create form in sheet
│   ├── ClientEditSheet.tsx      # Edit form in sheet (fetches data)
│   └── index.ts
├── ClientForm.tsx               # Extracted reusable form
└── OpenClientSheet.tsx          # Trigger button component
```

**Steps:**
1. Extract form logic from `ClientFormDialog` → `ClientForm.tsx`
2. Create `ClientCreateSheet.tsx` using `useClientParams().createClient`
3. Create `ClientEditSheet.tsx` using `useClientParams().clientId`
4. Create `OpenClientSheet.tsx` trigger component
5. Register sheets in `GlobalSheets`
6. Update `ClientsPageClient` to use new pattern
7. Delete old `ClientFormDialog.tsx`

### Phase 2: Crew Sheets
**Risk: Low | Files: 5 new, 1 modified, 1 deleted**

Same pattern as Client sheets.

**Files to create:**
```
apps/web/modules/saas/studio/hooks/params/
└── use-crew-params.ts

apps/web/modules/saas/studio/components/crews/
├── sheets/
│   ├── CrewCreateSheet.tsx
│   ├── CrewEditSheet.tsx
│   └── index.ts
├── CrewForm.tsx
└── OpenCrewSheet.tsx
```

### Phase 3: Configuration Sheets
**Risk: Medium | Files: 12+ new**

The `ConfigurationFormDialog` is generic (reused for 5+ config types). Two approaches:

**Option A: Generic ConfigSheet (simpler)**
```
hooks/params/use-configuration-params.ts
components/configurations/sheets/
├── ConfigurationCreateSheet.tsx
├── ConfigurationEditSheet.tsx
└── OpenConfigurationSheet.tsx
```

**Option B: Per-type sheets (like w-tales - more explicit)**
```
hooks/params/
├── use-booking-type-params.ts
├── use-package-type-params.ts
├── use-relation-type-params.ts
├── use-shoot-status-params.ts
└── use-crew-role-params.ts

components/configurations/sheets/
├── BookingTypeCreateSheet.tsx
├── BookingTypeEditSheet.tsx
├── PackageTypeCreateSheet.tsx
...etc
```

**Recommendation:** Start with Option A, refactor to B if needed.

### Phase 4: Future Sheets (New Functionality)
**Risk: Medium | Files: 10+ new**

Add sheets that don't exist yet (for booking detail pages):

| Sheet | Purpose | Opens From |
|-------|---------|------------|
| `ShootCreateSheet` | Add shoot to booking | Booking shoots tab |
| `ShootEditSheet` | Edit shoot | Shoot row action |
| `PaymentCreateSheet` | Add payment | Booking payments tab |
| `PaymentEditSheet` | Edit payment | Payment row action |
| `DeliverableCreateSheet` | Add deliverable | Booking deliverables tab |
| `DeliverableEditSheet` | Edit deliverable | Deliverable row action |

### Phase 5: Booking Quick-Create (Integration)
**Risk: Low | Files: 1 modified**

The booking wizard has inline client creation. After Phase 1, replace with:
```tsx
// Instead of inline dialog
<OpenClientSheet variant="link" label="Add new client" />
```

---

## Detailed Implementation

### 1. Params Hook Pattern

```typescript
// apps/web/modules/saas/studio/hooks/params/use-client-params.ts
import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

export function useClientParams(options?: { shallow?: boolean }) {
  const [params, setParams] = useQueryStates(
    {
      clientId: parseAsString,      // For edit sheet
      createClient: parseAsBoolean, // For create sheet
    },
    {
      history: "push",
      shallow: options?.shallow ?? true,
      ...options,
    }
  );

  return {
    ...params,
    setParams,
    // Convenience methods
    openCreate: () => setParams({ createClient: true, clientId: null }),
    openEdit: (id: string) => setParams({ clientId: id, createClient: null }),
    close: () => setParams({ clientId: null, createClient: null }),
  };
}
```

### 2. Sheet Component Pattern

```typescript
// apps/web/modules/saas/studio/components/clients/sheets/ClientCreateSheet.tsx
"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@ui/components/sheet";
import { useClientParams } from "@saas/studio/hooks/params/use-client-params";
import { ClientForm } from "../ClientForm";

export function ClientCreateSheet() {
  const { createClient, close } = useClientParams();
  const isOpen = Boolean(createClient);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Create Client</SheetTitle>
        </SheetHeader>
        <ClientForm onSuccess={close} onCancel={close} />
      </SheetContent>
    </Sheet>
  );
}
```

```typescript
// apps/web/modules/saas/studio/components/clients/sheets/ClientEditSheet.tsx
"use client";

import { Suspense } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@ui/components/sheet";
import { useClientParams } from "@saas/studio/hooks/params/use-client-params";
import { ClientForm } from "../ClientForm";
import { useClient } from "@saas/studio/hooks/queries/use-client";
import { Skeleton } from "@ui/components/skeleton";

function ClientEditSheetContent() {
  const { clientId, close } = useClientParams();
  const { data: client, isLoading } = useClient(clientId!);

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return <ClientForm client={client} onSuccess={close} onCancel={close} />;
}

export function ClientEditSheet() {
  const { clientId, close } = useClientParams();
  const isOpen = Boolean(clientId);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit Client</SheetTitle>
        </SheetHeader>
        {isOpen && (
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <ClientEditSheetContent />
          </Suspense>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

### 3. Global Sheets Registry

```typescript
// apps/web/modules/saas/studio/components/global-sheets.tsx
"use client";

import { Suspense } from "react";

// Clients
import { ClientCreateSheet } from "./clients/sheets/ClientCreateSheet";
import { ClientEditSheet } from "./clients/sheets/ClientEditSheet";

// Crews
import { CrewCreateSheet } from "./crews/sheets/CrewCreateSheet";
import { CrewEditSheet } from "./crews/sheets/CrewEditSheet";

// Configurations
import { BookingTypeCreateSheet, BookingTypeEditSheet } from "./configurations/sheets/BookingTypeSheets";
import { PackageTypeCreateSheet, PackageTypeEditSheet } from "./configurations/sheets/PackageTypeSheets";
// ... more configuration sheets

export function GlobalSheets() {
  return (
    <>
      {/* Clients */}
      <ClientCreateSheet />
      <Suspense fallback={null}>
        <ClientEditSheet />
      </Suspense>

      {/* Crews */}
      <CrewCreateSheet />
      <Suspense fallback={null}>
        <CrewEditSheet />
      </Suspense>

      {/* Configurations */}
      <BookingTypeCreateSheet />
      <Suspense fallback={null}>
        <BookingTypeEditSheet />
      </Suspense>

      <PackageTypeCreateSheet />
      <Suspense fallback={null}>
        <PackageTypeEditSheet />
      </Suspense>

      {/* ... more sheets */}
    </>
  );
}
```

### 4. Layout Integration

```typescript
// apps/web/modules/saas/studio/components/StudioLayoutClient.tsx
"use client";

import { GlobalSheets } from "./global-sheets";

export function StudioLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GlobalSheets />
    </>
  );
}
```

### 5. Trigger Button Pattern

```typescript
// apps/web/modules/saas/studio/components/clients/OpenClientSheet.tsx
"use client";

import { Button } from "@ui/components/button";
import { PlusIcon, PencilIcon } from "lucide-react";
import { useClientParams } from "@saas/studio/hooks/params/use-client-params";

export function OpenClientCreateSheet() {
  const { openCreate } = useClientParams();

  return (
    <Button onClick={openCreate}>
      <PlusIcon className="mr-2 h-4 w-4" />
      Add Client
    </Button>
  );
}

export function OpenClientEditSheet({ clientId }: { clientId: string }) {
  const { openEdit } = useClientParams();

  return (
    <Button variant="ghost" size="icon" onClick={() => openEdit(clientId)}>
      <PencilIcon className="h-4 w-4" />
    </Button>
  );
}
```

---

## File Structure

```
apps/web/modules/saas/studio/
├── hooks/
│   └── params/
│       ├── index.ts
│       ├── use-client-params.ts
│       ├── use-crew-params.ts
│       ├── use-booking-type-params.ts
│       ├── use-package-type-params.ts
│       ├── use-relation-type-params.ts
│       ├── use-shoot-status-params.ts
│       └── use-crew-role-params.ts
├── components/
│   ├── global-sheets.tsx
│   ├── clients/
│   │   ├── sheets/
│   │   │   ├── ClientCreateSheet.tsx
│   │   │   ├── ClientEditSheet.tsx
│   │   │   └── index.ts
│   │   ├── OpenClientSheet.tsx
│   │   └── ClientForm.tsx (extracted from dialog)
│   ├── crews/
│   │   └── sheets/
│   │       ├── CrewCreateSheet.tsx
│   │       ├── CrewEditSheet.tsx
│   │       └── index.ts
│   └── configurations/
│       └── sheets/
│           ├── BookingTypeSheets.tsx
│           ├── PackageTypeSheets.tsx
│           └── ...
```

---

## Migration Checklist

### Foundation (✅ DONE)
- [x] Create `hooks/params/` directory
- [x] Create base `useClientParams` hook with convenience methods
- [x] Create `GlobalSheets` component (empty registry)
- [x] Integrate `GlobalSheets` into `StudioLayoutClient`

### Phase 1: Client Sheets (Pilot) ✅ DONE
- [x] Extract `ClientForm` from `ClientFormDialog`
- [x] Create `ClientCreateSheet`
- [x] Create `ClientEditSheet`
- [x] Create `OpenClientSheet` trigger components
- [x] Register in `GlobalSheets`
- [x] Update `ClientsPageClient` to use new pattern
- [x] Remove old `ClientFormDialog`
- [ ] Test: create/edit/close flows
- [ ] Test: back button behavior
- [ ] Test: deep linking (`?clientId=123`)

### Phase 2: Crew Sheets ✅ DONE
- [x] Create `use-crew-params.ts`
- [x] Create `CrewForm.tsx`
- [x] Create `CrewCreateSheet`, `CrewEditSheet`
- [x] Create `OpenCrewSheet`
- [x] Register in `GlobalSheets`
- [x] Update `CrewsPageClient`
- [x] Remove old `CrewFormDialog`

### Phase 3: Configuration Sheets ✅ DONE
- [x] Create `use-configuration-params.ts` (generic approach)
- [x] Create `ConfigurationForm.tsx`
- [x] Create `ConfigurationCreateSheet`, `ConfigurationEditSheet`
- [x] Create `OpenConfigurationSheet`
- [x] Register in `GlobalSheets`
- [x] Update `ConfigurationsPageClient`
- [x] Remove old `ConfigurationFormDialog`

### Phase 4: Future Entity Sheets (New) ⬅️ NEXT
- [ ] Shoot sheets (create/edit)
- [ ] Payment sheets (create/edit)
- [ ] Deliverable sheets (create/edit)
- [ ] Task sheets (create/edit)
- [ ] Expense sheets (create/edit)

### Phase 5: Booking Quick-Create Integration
- [ ] Replace inline `CreateClientDialog` in booking wizard with `OpenClientSheet`

---

## Benefits After Migration

1. **Shareable URLs** - `/app/org/clients?clientId=123` opens edit sheet
2. **Back Button Works** - Closing sheet with back button is natural
3. **Bookmarkable** - Can bookmark "create client" page
4. **Consistent Pattern** - All sheets follow same pattern
5. **Global Access** - Open any sheet from anywhere via URL params
6. **Easier Testing** - Can navigate directly to sheet state

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| URL pollution | Use `shallow: true` to avoid full page refreshes |
| SSR complexity | Sheets are client-only, no SSR needed |
| Multiple sheets open | Design params to be mutually exclusive |
| Breaking existing links | No existing deep links to dialogs |

---

## Questions Resolved

1. **Confirmation dialogs?** - Keep as AlertDialog, not URL-based (they're transient)
2. **Sheet direction?** - Slide from right (like w-tales)
3. **Mobile behavior?** - Full-width sheet on mobile

---

## w-tales Reference

**Total sheets in w-tales:** 41 components across:
- Bookings, Clients, Crews, Configurations, Deliverables
- Expenses, Payments, Shoots, Tasks, Home/Review
