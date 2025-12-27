# Session: sidebar-reorganization
Updated: 2025-12-27T10:01:10.259Z

## Goal
Reorganize sidebar navigation to be more intuitive and reduce clicks to reach key items.

## Constraints
- Keep 2-level sidebar (icon rail + module panel)
- Use existing icon registry
- Maintain mobile navigation compatibility

## Key Decisions
- Single "Studio" module with building icon (consolidates home + bookings)
- Removed Inbox and Review items (not needed now)
- Configurations as separate module with slidersHorizontal icon
- Moved config pages from /settings/* to /configurations/*
- Settings shows in module panel footer (no "Studio" label)
- People group (Clients, Crew) at bottom

## State
- Done:
  - [x] Consolidated to 2 modules (Studio, Configurations)
  - [x] Added slidersHorizontal icon for Configurations
  - [x] Moved config pages to /configurations/ URL path
  - [x] Removed Inbox and Review items
  - [x] Updated ModuleId types
  - [x] Settings in footer without group label
  - [x] Final structure: Home/Dashboard, Operations, Finance, People
- Now: [→] Ready for commit
- Next: Test in browser

## Final Sidebar Structure

**Studio (building icon):**
- (no label): Home, Dashboard
- Operations: Bookings, Shoots, Deliverables, Tasks
- Finance: Payments, Expenses
- People: Clients, Crew

**Configurations (slidersHorizontal icon):**
- Configs: Booking Types, Package Types, Relation Types, Crew Roles

**Footer:** Settings

## Files Modified
- `apps/web/modules/saas/studio/lib/navigation.ts` - Module structure
- `apps/web/modules/saas/studio/lib/types.ts` - ModuleId type
- `apps/web/modules/saas/studio/lib/icons.ts` - Added slidersHorizontal
- `apps/web/modules/saas/studio/components/ModulePanel.tsx` - Removed Studio label from Settings
- `apps/web/modules/saas/studio/components/StudioSidebar.tsx` - Updated footer logic
- `apps/web/modules/saas/studio/components/MobileNav.tsx` - Updated props
- `apps/web/modules/saas/studio/components/StudioLayout.tsx` - Updated props
- `apps/web/app/(saas)/app/[organizationSlug]/configurations/` - New location for config pages

## Working Set
- Branch: `booking-crud`
- Key files: `apps/web/modules/saas/studio/lib/navigation.ts`
- Build cmd: `pnpm --filter web build`
