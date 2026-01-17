# Quick Links Feature - Implementation Plan

## Overview

Implement a personal Quick Links widget for the home page, allowing users to save and access frequently used URLs. Links are personal to each user but scoped per-organization.

---

## Data Model

### Database Table: `quick_links`

```sql
CREATE TABLE quick_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,  -- Better Auth user ID
    title VARCHAR(255),     -- Optional display title
    url TEXT NOT NULL,      -- The URL (required)
    metadata JSONB DEFAULT '{}',  -- For favicon URL, etc.
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT fk_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
    INDEX idx_quick_links_org_user (organization_id, user_id),
    INDEX idx_quick_links_sort (organization_id, user_id, sort_order)
);
```

### Drizzle Schema

**File:** `packages/database/drizzle/schema/studio.ts`

```typescript
export const quickLinks = pgTable("quick_links", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    title: varchar("title", { length: 255 }),
    url: text("url").notNull(),
    metadata: jsonb("metadata").default({}),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
    orgUserIdx: index("idx_quick_links_org_user").on(table.organizationId, table.userId),
}));
```

---

## API Layer

### Module Structure

```
packages/api/modules/quick-links/
├── schemas.ts           # Zod schemas for input/output
├── router.ts            # oRPC router export
└── procedures/
    ├── list.ts          # List user's quick links
    ├── create.ts        # Create a new link
    ├── update.ts        # Update link title/url
    ├── delete.ts        # Delete a link
    └── reorder.ts       # Update sort order (optional)
```

### Schemas (`schemas.ts`)

```typescript
import { z } from "zod";

export const quickLinkSchema = z.object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    userId: z.string(),
    title: z.string().nullable(),
    url: z.string().url(),
    metadata: z.record(z.unknown()).optional(),
    sortOrder: z.number(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const createQuickLinkInput = z.object({
    url: z.string().min(1, "URL is required"),
    title: z.string().optional(),
});

export const updateQuickLinkInput = z.object({
    id: z.string().uuid(),
    url: z.string().min(1).optional(),
    title: z.string().optional(),
});

export const deleteQuickLinkInput = z.object({
    id: z.string().uuid(),
});

export type QuickLink = z.infer<typeof quickLinkSchema>;
export type CreateQuickLinkInput = z.infer<typeof createQuickLinkInput>;
export type UpdateQuickLinkInput = z.infer<typeof updateQuickLinkInput>;
```

### Procedures

#### `list.ts`
- Input: None (uses session context)
- Output: Array of QuickLink
- Logic: `SELECT * FROM quick_links WHERE organization_id = ? AND user_id = ? ORDER BY sort_order, created_at DESC`

#### `create.ts`
- Input: `{ url: string, title?: string }`
- Output: QuickLink
- Logic:
  1. Validate URL format (prepend `https://` if missing protocol)
  2. Insert with `organization_id` from context, `user_id` from session
  3. Return created link

#### `update.ts`
- Input: `{ id: string, url?: string, title?: string }`
- Output: QuickLink
- Logic:
  1. Verify link exists and belongs to current user
  2. Update fields
  3. Return updated link

#### `delete.ts`
- Input: `{ id: string }`
- Output: `{ success: boolean }`
- Logic:
  1. Verify link exists and belongs to current user
  2. Delete link

---

## Frontend Layer

### Component Structure

```
apps/web/modules/saas/studio/components/home/widgets/quick-links/
├── index.tsx                    # Main widget component
├── quick-link-item.tsx          # Individual link chip
├── quick-link-modal.tsx         # Create/Edit modal
├── quick-links-empty-state.tsx  # Empty state UI
└── use-quick-links.ts           # Hook for link operations
```

### API Integration

**File:** `apps/web/modules/saas/studio/lib/api.ts`

```typescript
export const quickLinksApi = {
    listOptions: () => orpc.quickLinks.list.queryOptions({ input: {} }),
};

export const quickLinksMutations = {
    create: () => orpc.quickLinks.create,
    update: () => orpc.quickLinks.update,
    delete: () => orpc.quickLinks.delete,
};
```

### Main Widget (`index.tsx`)

```tsx
// Header: "Quicklinks" title + "+ Add quick Link" button
// Body: Flex-wrap container of QuickLinkItem chips
// Empty state when no links
// Modal for create/edit
```

**Styling (from Plane):**
- Header: `text-14 font-semibold text-tertiary` for title
- Add button: `text-13 font-medium text-accent-primary`
- Links container: `flex gap-2 flex-wrap`
- Max height: 150px with overflow wrapper

### Link Item (`quick-link-item.tsx`)

Each link displayed as a chip/pill:
- Favicon (from metadata or generated)
- Title or URL
- Click to open in new tab
- Context menu (right-click or three-dot):
  - Edit
  - Open in new tab
  - Copy link
  - Delete

**Styling:**
- Chip: `px-3 py-1.5 rounded-lg border bg-muted/30 hover:bg-muted/50`
- Favicon: `size-4 rounded`
- Text: `text-sm truncate max-w-[200px]`

### Create/Edit Modal (`quick-link-modal.tsx`)

Form fields:
1. **URL** (required) - Input with placeholder "https://example.com"
2. **Title** (optional) - Input with placeholder "Display name"

Actions:
- Cancel button
- Add/Update button (primary)

---

## Implementation Steps

### Phase 1: Database & API (Backend)

1. [ ] Add `quickLinks` table to Drizzle schema (`packages/database/drizzle/schema/studio.ts`)
2. [ ] Generate and run migration
3. [ ] Create `packages/api/modules/quick-links/schemas.ts`
4. [ ] Create `packages/api/modules/quick-links/procedures/list.ts`
5. [ ] Create `packages/api/modules/quick-links/procedures/create.ts`
6. [ ] Create `packages/api/modules/quick-links/procedures/update.ts`
7. [ ] Create `packages/api/modules/quick-links/procedures/delete.ts`
8. [ ] Create `packages/api/modules/quick-links/router.ts`
9. [ ] Register router in main API router

### Phase 2: Frontend Components

10. [ ] Add API utilities to `apps/web/modules/saas/studio/lib/api.ts`
11. [ ] Create `quick-links-empty-state.tsx`
12. [ ] Create `quick-link-modal.tsx` (create/edit form)
13. [ ] Create `quick-link-item.tsx` (individual link chip)
14. [ ] Create `index.tsx` (main widget)
15. [ ] Create `use-quick-links.ts` hook for mutations

### Phase 3: Integration

16. [ ] Add QuickLinksWidget to HomeView
17. [ ] Test create/edit/delete flows
18. [ ] Verify links are personal (user A can't see user B's links)
19. [ ] Run TypeScript check and lint

---

## UI Mockup (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│ Quicklinks                                    + Add quick Link │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 🌐 GitHub    │  │ 📊 Analytics │  │ 📝 Notion    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ 🎨 Figma     │  │ 📧 Gmail     │                         │
│  └──────────────┘  └──────────────┘                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Empty State:**
```
┌─────────────────────────────────────────────────────────────┐
│ Quicklinks                                    + Add quick Link │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│              ┌─────────────────────────┐                     │
│              │         🔗              │                     │
│              │                         │                     │
│              │  Keep important         │                     │
│              │  references, resources, │                     │
│              │  or docs handy for      │                     │
│              │  your work              │                     │
│              └─────────────────────────┘                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

### New Files
```
packages/database/drizzle/schema/studio.ts          # Add quickLinks table
packages/api/modules/quick-links/
├── schemas.ts
├── router.ts
└── procedures/
    ├── list.ts
    ├── create.ts
    ├── update.ts
    └── delete.ts

apps/web/modules/saas/studio/components/home/widgets/quick-links/
├── index.tsx
├── quick-link-item.tsx
├── quick-link-modal.tsx
├── quick-links-empty-state.tsx
└── use-quick-links.ts
```

### Modified Files
```
packages/api/orpc/router.ts                         # Register quickLinksRouter
apps/web/modules/saas/studio/lib/api.ts             # Add quickLinksApi
apps/web/modules/saas/studio/components/home/home-view.tsx  # Add widget
```

---

## Acceptance Criteria

- [ ] User can add a quick link with URL and optional title
- [ ] User can edit existing links
- [ ] User can delete links
- [ ] Links are displayed as chips in flex-wrap layout
- [ ] Clicking a link opens it in a new tab
- [ ] Links are personal (each user sees only their own)
- [ ] Links are scoped to organization
- [ ] Empty state shows when no links exist
- [ ] Modal validates URL format
- [ ] TypeScript compiles without errors
- [ ] Matches Plane's visual style
