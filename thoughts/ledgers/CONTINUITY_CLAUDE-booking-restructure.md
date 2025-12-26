# Session: booking-restructure
Updated: 2025-12-26T00:00:00Z

## Goal
Restructure bookings pages to render PageHeader immediately while streaming data.

## Constraints
- Single layout for smooth transitions between list and form views
- PageHeader renders instantly (no data blocking)
- Use Next.js streaming/Suspense patterns

## Key Decisions
- **Unified layout over route groups**: Route groups would cause layout remount on navigation, breaking smooth transitions. Single layout with conditional rendering preserves layout persistence.
- **Client layout with `use()` hook**: Layout uses `usePathname()` for route detection and `use(params)` for async params in client component.
- **Header in parent layout**: Removed duplicate PageHeader from `new/layout.tsx` - parent layout handles all header variations.

## State
- Done:
  - [x] Created unified `bookings/layout.tsx` with conditional PageHeader
  - [x] Created `bookings/loading.tsx` with table skeleton
  - [x] Removed PageHeader from `bookings/new/layout.tsx`
  - [x] Removed duplicate "New Booking" button from BookingsPageClient
- Now: Complete - ready for testing
- Next: Consider applying Next.js 16 cache patterns (see `CONTINUITY_CLAUDE-nextjs16-patterns.md`)

## Changes Made

### New Files
- `apps/web/app/(saas)/app/[organizationSlug]/bookings/layout.tsx` - Unified layout with conditional header
- `apps/web/app/(saas)/app/[organizationSlug]/bookings/loading.tsx` - Skeleton UI for streaming

### Modified Files
- `bookings/new/layout.tsx` - Removed PageHeader (uses parent)
- `BookingsPageClient.tsx` - Removed duplicate "New Booking" button

## Working Set
- Branch: `booking-crud`
- Key files:
  - `apps/web/app/(saas)/app/[organizationSlug]/bookings/layout.tsx`
  - `apps/web/app/(saas)/app/[organizationSlug]/bookings/loading.tsx`
  - `apps/web/app/(saas)/app/[organizationSlug]/bookings/page.tsx`
  - `apps/web/app/(saas)/app/[organizationSlug]/bookings/new/layout.tsx`
- Test: Run dev server, navigate between `/bookings` and `/bookings/new`

## Pattern Applied

```
bookings/
├── layout.tsx      # Unified layout - renders PageHeader immediately
│                   # Uses usePathname() to show "Bookings" or "New Booking"
├── loading.tsx     # Skeleton while page.tsx streams data
├── page.tsx        # Prefetches data, wraps with HydrationBoundary
└── new/
    └── layout.tsx  # Form-specific layout (no header - uses parent)
```

## Open Questions
- UNCONFIRMED: Test smooth transitions work in browser
- UNCONFIRMED: Consider adding animation to header title change
