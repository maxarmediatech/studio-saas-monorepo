# Session: booking-mock-data-removal
Updated: 2025-12-26T10:30:00Z

## Goal
Remove all mock data dependencies from the multi-page booking wizard. Done when:
- All dropdowns populate from real API data
- `mock-data.ts` is deleted
- Booking creation works end-to-end with real data

## Status: COMPLETED

All tasks have been completed successfully. The booking wizard now uses real API data.

## What Was Done

### Session 1 (Previous)
1. Auto-crew creation hook (`packages/auth/auth.ts` databaseHooks.member.create.after)
2. Crews Management UI (`/app/[orgSlug]/crews/` with full CRUD)
3. "Add to Crew" button for members without crew profiles

### Session 2 (2025-12-26)
1. **Clients Management UI** - Full CRUD at `/app/[orgSlug]/clients/`
   - `apps/web/app/(saas)/app/[organizationSlug]/clients/page.tsx`
   - `apps/web/modules/saas/studio/components/clients/ClientsPageClient.tsx`
   - `apps/web/modules/saas/studio/components/clients/ClientFormDialog.tsx`

2. **Settings Page** - Central hub for configurations at `/app/[orgSlug]/settings/`
   - `apps/web/app/(saas)/app/[organizationSlug]/settings/page.tsx`

3. **Configuration Management UIs** - Reusable components for all config types
   - `apps/web/modules/saas/studio/components/configurations/ConfigurationsPageClient.tsx`
   - `apps/web/modules/saas/studio/components/configurations/ConfigurationFormDialog.tsx`
   - `/settings/booking-types/` - Manage booking types
   - `/settings/package-types/` - Manage package types
   - `/settings/relation-types/` - Manage relation types
   - `/settings/crew-roles/` - Manage crew roles

4. **Backend Updates**
   - Added `crew_role` to `configTypeEnum` in database (`packages/database/drizzle/schema/enums.ts`)
   - Added `crew_role` to zod schema (`packages/api/modules/studio/schemas/common.ts`)
   - Added default crew_role configurations (`packages/api/modules/studio/schemas/configuration.ts`)
   - Database migration applied via `pnpm --filter @repo/database push`
   - Added `crewRolesOptions` helper to api.ts

5. **Removed Mock Data Fallbacks**
   - Updated `BookingDetailsStep.tsx` - uses real configs and clients
   - Updated `BookingShootsStep.tsx` - uses real crews and crew roles from configs
   - Updated `BookingReviewStep.tsx` - uses all real data
   - Deleted `apps/web/modules/saas/studio/lib/mock-data.ts`

6. **Config/Route Fixes**
   - Removed `/app/:organizationSlug/settings` -> `/settings/general` redirect from `next.config.ts` so settings hub page is accessible

## Known Issues (Deferred)
- **Form reset after booking creation**: After clicking "Create Booking" from sidebar, the form doesn't properly reset. Attempted fix with `didInitFromStoreRef.current = false` but needs more investigation. User wanted to defer.

## Key Decisions Maintained
- Full CRUD approach: Built management UIs for all entities
- Auto-crew creation: New org members automatically get crew profiles via better-auth hook
- Hardcoded options kept: PAYMENT_METHOD_OPTIONS, PAYMENT_SCHEDULE_PRESETS, SHOOT_TYPE_OPTIONS, DELIVERABLE_TYPE_OPTIONS (in booking-form-schema.ts)

## Patterns Used
- Server component prefetches with `queryClient.prefetchQuery()`
- Client component uses `useQuery` and `useMutation` from TanStack Query
- Reusable `ConfigurationsPageClient` component works with any config type
- DataTable pattern with row actions for CRUD operations
- Zustand with persist middleware for form draft state (`booking-form-draft` localStorage key)

## Working Set
- Branch: `booking-crud`
- Key files: `apps/web/app/(saas)/app/[organizationSlug]/bookings/new/layout.tsx`
- Form store: `apps/web/modules/saas/studio/components/bookings/booking-form/store/use-booking-form-store.ts`
