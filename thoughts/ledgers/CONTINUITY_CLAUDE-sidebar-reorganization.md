# Session: sidebar-reorganization
Updated: 2025-12-28T12:00:00.000Z

## Goal
Implement Dub-style two-column sidebar navigation with 64px rail + 240px panel.

## Constraints
- Keep current routes unchanged (URLs stay the same)
- Use primary color (orange/amber) for active states
- Keep dropdown behavior for OrgSwitcher
- Maintain mobile navigation compatibility via Sheet drawer

## Key Decisions
- Two-column sidebar: 64px rail + 240px panel = 304px total
- Rail: Org logo, 6 module icons with tooltips, Help, User avatar
- Panel: Active module's sections with scrollable nav items
- Header: Simplified - only mobile menu trigger, New action, UserMenu
- Active state: `bg-primary/10 text-primary`
- Fixed positioning on desktop, Sheet drawer on mobile

## State
- Done:
  - [x] Phase 1: Add RailIconConfig type to types.ts
  - [x] Phase 2: Create sidebar-rail.tsx
  - [x] Phase 2: Create sidebar-panel.tsx
  - [x] Phase 2: Create dub-sidebar.tsx
  - [x] Phase 3: Simplify site-header.tsx
  - [x] Phase 4: Update app-shell.tsx and app-shell.client.tsx
  - [x] Phase 5: Create mobile-sidebar.tsx
  - [x] Phase 6: Delete old components (module-tabs.tsx, app-sidebar.tsx, module-sidebar.tsx)
- Now: [→] Ready for testing and commit
- Next: Test in browser, commit changes

## New Files Created
- `apps/web/modules/saas/studio/components/navigation/sidebar-rail.tsx`
- `apps/web/modules/saas/studio/components/navigation/sidebar-panel.tsx`
- `apps/web/modules/saas/studio/components/navigation/dub-sidebar.tsx`
- `apps/web/modules/saas/studio/components/navigation/mobile-sidebar.tsx`

## Files Modified
- `apps/web/modules/saas/studio/lib/navigation/types.ts` - Added RailIconConfig
- `apps/web/modules/saas/studio/components/app-shell.tsx` - Generate railIcons, pass user props
- `apps/web/modules/saas/studio/components/app-shell.client.tsx` - Use DubSidebar, add mobile state
- `apps/web/modules/saas/studio/components/site-header.tsx` - Simplified, removed org switcher

## Files Deleted
- `apps/web/modules/saas/studio/components/navigation/module-tabs.tsx`
- `apps/web/modules/saas/studio/components/app-sidebar.tsx`
- `apps/web/modules/saas/studio/components/navigation/module-sidebar.tsx`

## Working Set
- Branch: `new-sidebar`
- Plan: `/Users/rakesh/.claude/plans/playful-imagining-papert.md`
- Build cmd: `pnpm --filter web build`
