# Stickies Feature Implementation Plan

## Overview

Stickies are personal quick notes displayed on the home page. Think of them as digital sticky notes - small, colorful notes for reminders, quick thoughts, or reference info.

## Data Model

### Database Schema

```sql
CREATE TABLE stickies (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT,
  content TEXT,
  color TEXT DEFAULT 'yellow',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX stickies_org_user_idx ON stickies(organization_id, user_id);
CREATE INDEX stickies_org_user_sort_idx ON stickies(organization_id, user_id, sort_order);
```

### Drizzle Schema

```typescript
// packages/database/drizzle/schema/studio.ts

export const stickies = pgTable(
  "stickies",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    organizationId: text("organization_id").notNull().references(() => organizations.id),
    userId: text("user_id").notNull().references(() => users.id),
    title: text("title"),
    content: text("content"),
    color: text("color").default("yellow"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index("stickies_org_user_idx").on(table.organizationId, table.userId),
    index("stickies_org_user_sort_idx").on(table.organizationId, table.userId, table.sortOrder),
  ]
);
```

### Color Options

```typescript
export const STICKY_COLORS = {
  yellow: { bg: "bg-yellow-100", border: "border-yellow-200", name: "Yellow" },
  blue: { bg: "bg-blue-100", border: "border-blue-200", name: "Blue" },
  green: { bg: "bg-green-100", border: "border-green-200", name: "Green" },
  pink: { bg: "bg-pink-100", border: "border-pink-200", name: "Pink" },
  purple: { bg: "bg-purple-100", border: "border-purple-200", name: "Purple" },
  orange: { bg: "bg-orange-100", border: "border-orange-200", name: "Orange" },
  gray: { bg: "bg-gray-100", border: "border-gray-200", name: "Gray" },
} as const;

export type StickyColor = keyof typeof STICKY_COLORS;
```

---

## API Design

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/stickies | List user's stickies |
| POST | /api/stickies | Create a sticky |
| PUT | /api/stickies/{id} | Update a sticky |
| DELETE | /api/stickies/{id} | Delete a sticky |

### Schemas

```typescript
// packages/api/modules/stickies/schemas.ts

export const stickySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  title: z.string().nullable(),
  content: z.string().nullable(),
  color: z.string(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listStickiesInputSchema = z.object({});

export const listStickiesOutputSchema = z.object({
  data: z.array(stickySchema),
});

export const createStickyInputSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  color: z.string().optional().default("yellow"),
});

export const updateStickyInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  content: z.string().optional(),
  color: z.string().optional(),
});

export const deleteStickyInputSchema = z.object({
  id: z.string().min(1),
});
```

---

## Frontend Components

### Directory Structure

```
apps/web/modules/saas/studio/components/home/widgets/stickies/
├── index.tsx                 # Main widget for home page
├── sticky-card.tsx           # Individual sticky note card
├── sticky-modal.tsx          # Create/Edit modal
├── sticky-color-picker.tsx   # Color selection component
└── constants.ts              # Color definitions
```

### StickiesWidget (index.tsx)

Main widget displayed on home page:
- Header: "Stickies" title + "+ Add sticky" button
- Grid of StickyCard components (responsive: 1 col mobile, 2 cols tablet, 3 cols desktop)
- Max height with overflow scroll
- Empty state when no stickies
- Loading skeleton

```tsx
<div className="py-4">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-semibold text-muted-foreground">Stickies</h3>
    <button className="flex items-center gap-1 text-sm font-medium text-primary">
      <PlusIcon className="size-4" />
      Add sticky
    </button>
  </div>
  
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
    {stickies.map((sticky) => (
      <StickyCard key={sticky.id} sticky={sticky} />
    ))}
  </div>
</div>
```

### StickyCard (sticky-card.tsx)

Individual sticky note display:
- Colored background based on sticky.color
- Title (bold, truncated if long)
- Content preview (truncated to ~3 lines)
- Click to open edit modal
- Context menu (three dots): Edit, Change color, Delete

```tsx
<div 
  className={cn(
    "p-4 rounded-xl border cursor-pointer hover:shadow-sm transition-shadow",
    STICKY_COLORS[sticky.color].bg,
    STICKY_COLORS[sticky.color].border
  )}
  onClick={() => onEdit(sticky)}
>
  <div className="flex items-start justify-between gap-2">
    <h4 className="font-medium text-sm line-clamp-1">
      {sticky.title || "Untitled"}
    </h4>
    <DropdownMenu>...</DropdownMenu>
  </div>
  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
    {sticky.content || "No content"}
  </p>
</div>
```

### StickyModal (sticky-modal.tsx)

Create/Edit dialog:
- Title input (optional)
- Content textarea (auto-resize)
- Color picker row
- Cancel / Save buttons

```tsx
<Dialog>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>{isEditing ? "Edit Sticky" : "New Sticky"}</DialogTitle>
    </DialogHeader>
    
    <form className="space-y-4">
      <Field>
        <FieldLabel>Title (optional)</FieldLabel>
        <Input placeholder="Quick note title..." />
      </Field>
      
      <Field>
        <FieldLabel>Content</FieldLabel>
        <Textarea 
          placeholder="Write your note here..."
          className="min-h-[120px] resize-none"
        />
      </Field>
      
      <StickyColorPicker value={color} onChange={setColor} />
      
      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

### StickyColorPicker (sticky-color-picker.tsx)

Horizontal row of color circles:
```tsx
<div className="flex items-center gap-2">
  <span className="text-sm text-muted-foreground">Color:</span>
  <div className="flex gap-1.5">
    {Object.entries(STICKY_COLORS).map(([key, { bg }]) => (
      <button
        key={key}
        type="button"
        onClick={() => onChange(key)}
        className={cn(
          "size-6 rounded-full border-2 transition-all",
          bg,
          value === key ? "border-primary scale-110" : "border-transparent"
        )}
      />
    ))}
  </div>
</div>
```

---

## Implementation Steps

### Phase 1: Database & API

1. Add `stickies` table to Drizzle schema (`packages/database/drizzle/schema/studio.ts`)
2. Generate and run migration
3. Create API module:
   - `packages/api/modules/stickies/schemas.ts`
   - `packages/api/modules/stickies/procedures/list.ts`
   - `packages/api/modules/stickies/procedures/create.ts`
   - `packages/api/modules/stickies/procedures/update.ts`
   - `packages/api/modules/stickies/procedures/delete.ts`
   - `packages/api/modules/stickies/router.ts`
4. Register router in `packages/api/orpc/router.ts`
5. Add `stickiesApi` to `apps/web/modules/saas/studio/lib/api.ts`

### Phase 2: Frontend Widget

6. Create `constants.ts` with STICKY_COLORS
7. Create `sticky-color-picker.tsx`
8. Create `sticky-card.tsx`
9. Create `sticky-modal.tsx`
10. Create `index.tsx` (StickiesWidget)
11. Add StickiesWidget to HomeView

### Phase 3: Polish

12. Add loading skeletons
13. Add empty state
14. Test CRUD operations
15. Verify cache invalidation with `orpc.stickies.key()`

---

## UI Behavior

### Empty State
```tsx
<div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-xl">
  <StickyNoteIcon className="size-10 text-muted-foreground/30 mb-3" />
  <p className="text-sm text-muted-foreground">
    Jot down quick notes and reminders
  </p>
</div>
```

### Loading State
Grid of skeleton cards matching the sticky card dimensions.

### Interactions
- Click card → Open edit modal
- Click "+ Add sticky" → Open create modal (empty form, default yellow)
- Context menu → Edit, Change color (submenu), Delete
- Delete → Confirmation dialog

---

## Future Enhancements (Out of Scope)

- [ ] Drag-and-drop reordering
- [ ] Rich text editor (markdown or TipTap)
- [ ] Full page view at `/app/{org}/stickies`
- [ ] Search/filter stickies
- [ ] Pin important stickies to top
- [ ] Archive stickies instead of delete

---

## Files to Create/Modify

### New Files
```
packages/database/drizzle/schema/studio.ts          # Add stickies table
packages/api/modules/stickies/
├── schemas.ts
├── router.ts
└── procedures/
    ├── list.ts
    ├── create.ts
    ├── update.ts
    └── delete.ts

apps/web/modules/saas/studio/components/home/widgets/stickies/
├── index.tsx
├── sticky-card.tsx
├── sticky-modal.tsx
├── sticky-color-picker.tsx
└── constants.ts
```

### Modified Files
```
packages/api/orpc/router.ts                         # Register stickiesRouter
apps/web/modules/saas/studio/lib/api.ts             # Add stickiesApi
apps/web/modules/saas/studio/components/home/home-view.tsx  # Add StickiesWidget
```

---

## Acceptance Criteria

- [ ] Can create a new sticky with title, content, and color
- [ ] Can edit existing sticky
- [ ] Can delete sticky with confirmation
- [ ] Can change sticky color from context menu
- [ ] Stickies persist per user per organization
- [ ] Stickies display in responsive grid
- [ ] Empty state shows when no stickies
- [ ] Loading skeleton during fetch
- [ ] Cache invalidates properly after mutations
- [ ] TypeScript compiles without errors
