# Rich Text Editor Implementation Plan

> **Status**: Production-ready implementation, no shortcuts
> **Scope**: First for discussions, then app-wide
> **Decision**: ProseMirror JSON as canonical storage (Oracle-approved)

---

## Architecture Overview

### Storage Format Decision

**Canonical**: ProseMirror/TipTap JSON
- Lossless - preserves exact document structure
- Mentions are first-class nodes
- Future extensibility (embeds, attachments, custom nodes)
- No round-trip formatting loss

**Derived Fields** (generated on save):
- `content_text` - Plain text for search, previews, notifications
- `mentioned_user_ids` - Extracted to relational table

### Tech Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Editor Framework | TipTap | Already in codebase (StickyEditor), Plane uses it, great React support |
| Suggestions | @tiptap/suggestion | Powers both @mentions and /slash commands |
| Positioning | @floating-ui/react | Dropdown positioning relative to cursor |
| Server Rendering | @tiptap/html | `generateHTML` with same extensions |

---

## Database Schema Changes

### Updated Tables

```typescript
// discussions table - add JSON storage
content_json: jsonb("content_json"),           // Canonical JSON content
content_text: text("content_text"),            // Derived plain text for search
schema_version: integer("schema_version").default(1), // For future migrations

// discussion_messages table - add JSON storage  
content_json: jsonb("content_json").notNull(), // Canonical JSON content
content_text: text("content_text").notNull(),  // Derived plain text

// Remove old 'content' column after migration (or keep for backward compat)
```

### New Tables

```typescript
// Relational mentions table
export const discussionMentions = pgTable(
  "discussion_mentions",
  {
    id: varchar("id", { length: 255 }).$defaultFn(() => uuidv7()).primaryKey(),
    
    // Polymorphic - can reference discussion or message
    entityType: varchar("entity_type", { length: 50 }).notNull(), // 'discussion' | 'message'
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    
    mentionedUserId: varchar("mentioned_user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("discussion_mentions_unique").on(
      table.entityType,
      table.entityId,
      table.mentionedUserId,
    ),
    index("discussion_mentions_user_idx").on(table.mentionedUserId),
    index("discussion_mentions_entity_idx").on(table.entityType, table.entityId),
  ],
);
```

---

## Package Structure

```
packages/editor/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                          # Public exports
│   │
│   ├── schema/
│   │   ├── index.ts                      # Central extension registry
│   │   ├── extensions.ts                 # All TipTap extensions configured
│   │   └── version.ts                    # Schema version constant
│   │
│   ├── components/
│   │   ├── editor.tsx                    # Full-featured editor (posts)
│   │   ├── lite-editor.tsx               # Lightweight editor (comments/replies)
│   │   ├── read-only-renderer.tsx        # SSR-safe content renderer
│   │   └── bubble-menu/
│   │       ├── index.tsx
│   │       ├── formatting-buttons.tsx
│   │       └── link-editor.tsx
│   │
│   ├── extensions/
│   │   ├── index.ts
│   │   ├── mentions/
│   │   │   ├── extension.ts              # TipTap mention extension config
│   │   │   ├── mention-list.tsx          # Dropdown UI component
│   │   │   ├── mention-node.tsx          # Rendered mention badge
│   │   │   └── types.ts
│   │   ├── slash-commands/
│   │   │   ├── extension.ts              # Slash command extension
│   │   │   ├── command-list.tsx          # Dropdown UI component
│   │   │   ├── command-item.tsx          # Individual command row
│   │   │   └── commands.ts               # Command definitions
│   │   └── enter-key/
│   │       └── extension.ts              # Submit on Enter, newline on Shift+Enter
│   │
│   ├── hooks/
│   │   ├── use-editor.ts                 # Core editor hook with config
│   │   ├── use-mention-search.ts         # Debounced member search
│   │   └── use-editor-submit.ts          # Handle submit with validation
│   │
│   ├── lib/
│   │   ├── render.ts                     # renderJsonToHtml, renderJsonToText
│   │   ├── extract.ts                    # extractMentions, extractLinks
│   │   ├── sanitize.ts                   # Input validation, output sanitization
│   │   └── utils.ts                      # Helper functions
│   │
│   └── types/
│       ├── index.ts
│       ├── editor.ts                     # Editor props, ref types
│       ├── mention.ts                    # Mention node types
│       └── content.ts                    # JSON content types
│
└── styles/
    └── editor.css                        # Editor-specific styles (minimal)
```

---

## Implementation Phases

### Phase 0: Foundation & Schema (Day 1)
**Goal**: Database schema + package skeleton

- [ ] Create `packages/editor` package with tsconfig, package.json
- [ ] Add dependencies:
  ```bash
  pnpm add @tiptap/react @tiptap/core @tiptap/starter-kit \
    @tiptap/extension-mention @tiptap/extension-placeholder \
    @tiptap/extension-link @tiptap/suggestion @tiptap/html \
    @floating-ui/react
  ```
- [ ] Create database migration:
  - Add `content_json`, `content_text`, `schema_version` to discussions
  - Add `content_json`, `content_text` to discussion_messages
  - Create `discussion_mentions` table
- [ ] Define schema version constant and extension registry
- [ ] Configure `transpilePackages` in Next.js config

### Phase 1: Read-Only Renderer (Day 1-2)
**Goal**: Render JSON content safely on server and client

- [ ] Implement `renderJsonToHtml(json, extensions)` using `@tiptap/html`
- [ ] Implement `renderJsonToText(json)` for previews/search
- [ ] Create `<ReadOnlyRenderer content={json} />` component
- [ ] Add HTML sanitization layer (DOMPurify or similar)
- [ ] Test SSR rendering in discussions list preview
- [ ] Handle empty/null content gracefully

### Phase 2: Core Editor Components (Day 2-3)
**Goal**: Basic editor that saves JSON

- [ ] Implement `useEditor` hook with base extensions:
  - StarterKit (bold, italic, lists, code, etc.)
  - Placeholder
  - Link
- [ ] Create `<LiteEditor>` component:
  - Props: `placeholder`, `value`, `onChange`, `onSubmit`, `disabled`
  - Enter to submit, Shift+Enter for newline
  - Auto-focus handling
  - Disabled state styling
- [ ] Create `<Editor>` component (full-featured):
  - All LiteEditor features
  - Configurable extensions
  - Optional bubble menu
  - Optional slash commands
- [ ] Wire up to discussions API:
  - Update createMessage to accept JSON
  - Update createDiscussion to accept JSON
  - Server-side: derive `content_text` from JSON before save

### Phase 3: Mention System (Day 3-4)
**Goal**: @mention team members with autocomplete

- [ ] Create mention extension with custom config:
  ```typescript
  Mention.configure({
    HTMLAttributes: { class: "mention" },
    suggestion: {
      char: "@",
      items: ({ query }) => searchMembers(query),
      render: () => MentionListRenderer,
    },
  });
  ```
- [ ] Implement `<MentionList>` dropdown:
  - Keyboard navigation (Arrow keys, Enter, Escape)
  - Mouse selection
  - Loading state
  - Empty state ("No members found")
  - Scroll into view for selected item
- [ ] Implement `<MentionNode>` rendered badge:
  - UserAvatar + name
  - Hover card (optional, future)
- [ ] Create member search API endpoint (if not exists):
  - Search by name
  - Filter by organization
  - Limit results (10 max)
- [ ] Server-side mention extraction:
  ```typescript
  function extractMentions(json: JSONContent): string[] {
    const mentions: string[] = [];
    // Traverse JSON, find mention nodes, collect userIds
    return [...new Set(mentions)];
  }
  ```
- [ ] Save mentions to `discussion_mentions` table on create/update
- [ ] Add ARIA attributes for accessibility

### Phase 4: Slash Commands (Day 4-5)
**Goal**: /command menu for quick formatting

- [ ] Define command list:
  ```typescript
  const COMMANDS = [
    { key: "h1", title: "Heading 1", icon: Heading1, action: toggleHeading(1) },
    { key: "h2", title: "Heading 2", icon: Heading2, action: toggleHeading(2) },
    { key: "bullet", title: "Bullet List", icon: List, action: toggleBulletList },
    { key: "numbered", title: "Numbered List", icon: ListOrdered, action: toggleOrderedList },
    { key: "task", title: "Task List", icon: ListTodo, action: toggleTaskList },
    { key: "quote", title: "Quote", icon: Quote, action: toggleBlockquote },
    { key: "code", title: "Code Block", icon: Code, action: toggleCodeBlock },
    { key: "divider", title: "Divider", icon: Minus, action: insertHorizontalRule },
  ];
  ```
- [ ] Create slash command extension:
  - Trigger on "/"
  - Filter commands by query
  - Position dropdown at cursor
- [ ] Implement `<CommandList>` dropdown:
  - Search/filter as you type
  - Keyboard navigation
  - Icons + titles + descriptions
  - Sections (optional: "Basic", "Lists", "Media")
- [ ] Handle edge cases:
  - Don't trigger in code blocks
  - Close on click outside
  - Close on Escape

### Phase 5: Bubble Menu (Day 5)
**Goal**: Formatting toolbar on text selection

- [ ] Create `<BubbleMenu>` component:
  - Show on text selection
  - Position above selection
  - Hide on empty selection
- [ ] Formatting buttons:
  - Bold, Italic, Underline, Strikethrough
  - Code (inline)
  - Link (with URL input popover)
- [ ] Link editor popover:
  - URL input
  - Open in new tab toggle
  - Remove link button
- [ ] Smooth show/hide animations
- [ ] Mobile-friendly touch handling

### Phase 6: Paste Handling & Security (Day 5-6)
**Goal**: Safe, consistent paste behavior

- [ ] Configure paste handling:
  - Strip unwanted HTML from Google Docs, Notion, etc.
  - Preserve allowed formatting (bold, italic, links, lists)
  - Convert unsupported elements to plain text
- [ ] Input validation:
  - Validate JSON structure on server
  - Whitelist allowed node types and marks
  - Reject/strip unknown attributes
  - Validate URLs (block `javascript:`, etc.)
  - Enforce max document size
- [ ] Output sanitization:
  - Sanitize HTML before rendering (DOMPurify)
  - Escape user-generated text in mention labels
- [ ] Add rate limiting considerations for search endpoints

### Phase 7: Integration & Polish (Day 6-7)
**Goal**: Wire up to discussions feature

- [ ] Update Discussion Detail Page:
  - Replace bottom composer `<Input>` with `<LiteEditor>`
  - Replace ThreadCard reply inputs with `<LiteEditor>`
  - Use `<ReadOnlyRenderer>` for message content display
- [ ] Update New Discussion Sheet:
  - Replace content textarea with `<Editor>`
  - Support slash commands and bubble menu
- [ ] Update Discussion List:
  - Use `content_text` for preview snippets
  - Truncate appropriately
- [ ] Handle edit mode:
  - Load existing JSON into editor
  - Re-extract mentions on update
  - Update mention table (delete old, insert new)
- [ ] Loading states and error handling
- [ ] Optimistic updates for better UX

### Phase 8: Accessibility & Mobile (Day 7)
**Goal**: Production-ready for all users

- [ ] Keyboard accessibility:
  - Tab navigation in/out of editor
  - All dropdowns keyboard navigable
  - Focus trapping in modals/popovers
- [ ] ARIA attributes:
  - `role="listbox"` for suggestion dropdowns
  - `aria-selected` for selected items
  - `aria-label` for buttons
  - Screen reader announcements
- [ ] Mobile testing:
  - Virtual keyboard handling
  - Dropdown positioning near keyboard
  - Touch-friendly hit targets
  - iOS Safari quirks
  - IME input (CJK languages)
- [ ] Enter-to-submit vs composition:
  - Don't submit during IME composition
  - Use `compositionstart`/`compositionend` events

### Phase 9: Performance & Bundle (Day 8)
**Goal**: Fast loading, small bundle

- [ ] Dynamic imports:
  ```typescript
  const Editor = dynamic(() => import("@repo/editor"), { 
    ssr: false,
    loading: () => <EditorSkeleton />
  });
  ```
- [ ] Code split editor from main bundle
- [ ] Lazy load slash commands and bubble menu
- [ ] Measure bundle size impact
- [ ] Add editor skeleton loading state
- [ ] Consider `content_html` cache column for frequently-read content

### Phase 10: Testing (Day 8-9)
**Goal**: Confidence in production

- [ ] Unit tests:
  - `renderJsonToHtml` with various inputs
  - `renderJsonToText` accuracy
  - `extractMentions` edge cases
  - Input validation/sanitization
- [ ] Integration tests:
  - Create message with mentions
  - Edit message, mentions update
  - Search members
- [ ] E2E tests (Playwright):
  - Type in editor, submit
  - @mention flow (type @, select, submit)
  - /slash command flow
  - Keyboard navigation in dropdowns
  - Paste content
- [ ] Visual regression tests (optional)

---

## API Changes

### Create Message (Updated)

```typescript
// Input
{
  discussionId: string;
  content_json: JSONContent;  // TipTap JSON
  parentId?: string;
}

// Server processing
1. Validate JSON structure against schema whitelist
2. Extract plain text: content_text = renderJsonToText(content_json)
3. Extract mentions: mentionedUserIds = extractMentions(content_json)
4. Insert message with content_json, content_text
5. Insert into discussion_mentions table
6. (Future) Create notifications for mentioned users
```

### Create Discussion (Updated)

```typescript
// Input
{
  channelId: string;
  title: string;
  content_json?: JSONContent;
  links?: Array<{ entityType, entityId }>;
}

// Server processing
1. Validate JSON if provided
2. Derive content_text
3. Extract mentions
4. Insert discussion
5. Insert mentions
```

### Update Message/Discussion

```typescript
// Server processing
1. Validate new JSON
2. Re-derive content_text
3. Re-extract mentions
4. Update content columns
5. Delete old mentions, insert new mentions (or upsert)
```

---

## JSON Content Examples

### Simple Text
```json
{
  "type": "doc",
  "content": [{
    "type": "paragraph",
    "content": [{ "type": "text", "text": "Hello world" }]
  }]
}
```

### With Formatting
```json
{
  "type": "doc",
  "content": [{
    "type": "paragraph",
    "content": [
      { "type": "text", "text": "This is " },
      { "type": "text", "marks": [{ "type": "bold" }], "text": "bold" },
      { "type": "text", "text": " and " },
      { "type": "text", "marks": [{ "type": "italic" }], "text": "italic" }
    ]
  }]
}
```

### With Mention
```json
{
  "type": "doc",
  "content": [{
    "type": "paragraph",
    "content": [
      { "type": "text", "text": "Hey " },
      { 
        "type": "mention", 
        "attrs": { 
          "id": "user_abc123", 
          "label": "John Doe" 
        }
      },
      { "type": "text", "text": " what do you think?" }
    ]
  }]
}
```

### Complex Document
```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 2 },
      "content": [{ "type": "text", "text": "Project Update" }]
    },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "cc " },
        { "type": "mention", "attrs": { "id": "user_1", "label": "Alice" } },
        { "type": "text", "text": " and " },
        { "type": "mention", "attrs": { "id": "user_2", "label": "Bob" } }
      ]
    },
    {
      "type": "bulletList",
      "content": [
        { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Task 1 complete" }] }] },
        { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Task 2 in progress" }] }] }
      ]
    }
  ]
}
```

---

## Security Checklist

- [ ] **Input validation**: Whitelist allowed node types, reject unknown
- [ ] **URL validation**: Block `javascript:`, `data:`, relative URLs in links
- [ ] **Size limits**: Max document size (e.g., 100KB JSON, 50KB text)
- [ ] **Depth limits**: Max nesting depth to prevent DoS
- [ ] **HTML sanitization**: DOMPurify on all rendered HTML
- [ ] **Mention validation**: Verify mentioned users exist and are in org
- [ ] **Rate limiting**: Search endpoints, create endpoints
- [ ] **XSS prevention**: Escape all user text in rendered output

---

## Dependencies

```json
{
  "@tiptap/core": "^2.22.3",
  "@tiptap/react": "^2.22.3",
  "@tiptap/starter-kit": "^2.22.3",
  "@tiptap/extension-mention": "^2.22.3",
  "@tiptap/extension-placeholder": "^2.22.3",
  "@tiptap/extension-link": "^2.22.3",
  "@tiptap/suggestion": "^2.22.3",
  "@tiptap/html": "^2.22.3",
  "@floating-ui/react": "^0.26.4",
  "dompurify": "^3.0.0"
}
```

---

## Effort Estimate

| Phase | Description | Days |
|-------|-------------|------|
| 0 | Foundation & Schema | 1 |
| 1 | Read-Only Renderer | 1 |
| 2 | Core Editor Components | 1.5 |
| 3 | Mention System | 1.5 |
| 4 | Slash Commands | 1 |
| 5 | Bubble Menu | 0.5 |
| 6 | Paste Handling & Security | 1 |
| 7 | Integration & Polish | 1 |
| 8 | Accessibility & Mobile | 1 |
| 9 | Performance & Bundle | 0.5 |
| 10 | Testing | 1 |

**Total: ~10-11 days** for production-ready implementation

---

## References

- **Plane Editor**: `/Users/rakesh/Developer/agency/plane/packages/editor`
- **Existing TipTap in codebase**: `apps/web/.../stickies/sticky-editor.tsx`
- **TipTap Docs**: https://tiptap.dev/docs
- **TipTap Mention**: https://tiptap.dev/docs/editor/extensions/nodes/mention
- **TipTap Suggestion**: https://tiptap.dev/docs/editor/extensions/functionality/suggestion
- **Floating UI**: https://floating-ui.com/docs/react
