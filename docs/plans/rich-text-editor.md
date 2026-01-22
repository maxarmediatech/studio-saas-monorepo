#+#+#+#+-----------------------------------------------------------------------
Rich Text Editor (Single-User) - Implementation Plan
Plane-Inspired Architecture for Studio SaaS Monorepo
-----------------------------------------------------------------------

## Overview

We will integrate a production-grade rich text editor into the Studio SaaS app using TipTap (already present in the repo) with a Plane-inspired architecture:

- Shared editor package (the app consumes a stable API; editor internals live in one place).
- Canonical storage as ProseMirror/TipTap JSON (lossless, extensible, safe to evolve).
- Derived fields for performance + product needs (plain text for previews/search; mentions extracted for notifications later).
- Form-level autosave (debounced persistence owned by feature code, not by the editor).

This plan explicitly avoids real-time collaboration (Yjs/Hocuspocus) because the current product need is mostly single-user editing.

## Current State (Evidence)

### TipTap already exists in the repo

- TipTap deps in: `apps/web/package.json` (e.g. `@tiptap/react` `^3.15.3`).
- Existing editor implementation: `apps/web/modules/saas/studio/components/home/widgets/stickies/sticky-editor.tsx`
  - Uses `immediatelyRender: false` to reduce SSR/hydration issues.
  - Uses `onUpdate` -> `onChange(editor.getHTML())`.
  - Syncs external changes with selection preservation.

### Autosave patterns already exist

- Form-level autosave for stickies: `apps/web/modules/saas/studio/components/home/widgets/stickies/sticky-note.tsx`
  - Debounced save (500ms) + flush on blur.
  - Avoids overwriting local edits while focused.

### Discussions currently store plain text

- DB schema: `packages/database/drizzle/schema/discussions.ts`
  - `discussions.content` is `text`.
  - `discussion_messages.content` is `text`.
- API schemas: `packages/api/modules/discussions/schemas.ts`
  - `createDiscussionInputSchema.content` is `string`.
  - `createMessageInputSchema.content` is `string`.
- Web UI uses `<Textarea>` for discussion content: `apps/web/modules/saas/studio/components/discussions/discussion-form.tsx`

### Existing stickies table stores HTML

- DB schema: `packages/database/drizzle/schema/studio.ts` has `stickies.descriptionHtml: text("description_html")`.
- Stickies UI uses TipTap HTML content as source: `apps/web/modules/saas/studio/components/home/widgets/stickies/sticky-note.tsx`.

## Desired End State

### Functional

1. Discussions (create/update) and discussion messages (create/update) accept rich text.
2. Data is stored as JSON (canonical) + derived text for preview/search.
3. Server validates incoming editor JSON against an allowlist (node types, marks, URL schemes) and enforces size/depth limits.
4. Read-only rendering is consistent with editing.
5. Autosave is implemented at the feature/form level where needed (not coupled to the editor package).

### Observable / Pass-Fail

- Users can format text (bold/italic/lists/links) in discussions.
- Discussions list preview does NOT use raw JSON; it uses derived `contentText`.
- Backend rejects invalid/unknown editor nodes.
- Links cannot use `javascript:` / `data:` protocols.
- No cursor-jump regressions when external content updates arrive.

## What We Are NOT Doing

- No real-time multi-user collaboration (no Yjs/Hocuspocus/websocket server).
- No full plane-style custom HTML tag ecosystem (e.g., `<mention-component>`, `<image-component>`) in the first release.
- No file uploads inside the editor in the first release.
- No cross-surface conversion of all existing HTML/text fields immediately; we will start with Discussions.

## Key Design Decisions

### Canonical storage: TipTap JSON

Why:
- Lossless document structure.
- Extensible for mentions, embeds, attachments later.
- Avoids brittle HTML round-trips.

Derived fields:
- `contentText`: plain text derived from JSON for previews/search.
- (Optional future) `contentHtml`: derived, sanitized HTML cache for fast rendering.

### Autosave: form-level

The editor emits content changes and exposes a ref API.
Feature code decides:
- when to save (debounce, blur, unmount)
- what to save (single field vs whole record)
- how to handle failures (toast, retry, offline, etc.)

We will standardize a small `useDebouncedAutosave` hook that mirrors the proven sticky pattern.

## Package Architecture (Plane-inspired)

Plane centralizes editor logic into a single shared package and exposes a stable API to apps.
We will do the same with a new package:

```
packages/editor/
  package.json
  src/
    index.ts                 # React exports (editors)
    core/
      index.ts               # Non-React exports (schema/render/extract/validate)
      schema.ts              # Extension registry + schema version
      validate.ts            # JSON allowlist + size/depth/url validation
      extract.ts             # extractText/extractMentions utilities
      render.ts              # renderJsonToHtml/renderJsonToText
    react/
      use-rich-text-editor.ts
      rich-text-editor.tsx
      lite-rich-text-editor.tsx
      read-only-renderer.tsx
    types.ts
```

Notes:
- Keep `core/*` free of React so `packages/api` can safely import it.
- Editors are client components (TipTap is DOM-centric). We will keep them in React exports.

## Data Model Changes

### Discussions tables

Target schema (additive, backward compatible initially):

- `discussions`:
  - add `contentJson jsonb null`
  - add `contentText text null`
  - add `contentSchemaVersion int not null default 1`
- `discussion_messages`:
  - add `contentJson jsonb not null`
  - add `contentText text not null`
  - add `contentSchemaVersion int not null default 1`

Migration strategy:
- Keep existing `content` columns for a short transition.
- Write new content to JSON columns.
- Read path: prefer JSON; fallback to `content` and convert on the fly.

## API Changes (ORPC)

### Input

- Add `contentJson` to create/update inputs for discussions and messages.
- Transitional: continue accepting `content` (string) while UI migrates.

### Server-side validation

Validation entrypoint (new): `packages/editor/src/core/validate.ts`

Rules (MVP):
- Whitelist node types/marks we support (StarterKit subset + link + taskList).
- Enforce max JSON size (e.g. 200KB) and max depth (e.g. 20) to prevent DoS.
- Validate link href protocols: `http`, `https`, `mailto`, `tel`.

### Derived fields

Compute on write:
- `contentText = extractText(contentJson)`.

## Rendering Strategy

MVP rendering:
- Use a read-only renderer component that renders JSON in a safe, consistent way.
- Prefer generating HTML from JSON using the same extension registry.
- Sanitize any HTML that will be rendered with `dangerouslySetInnerHTML`.

Security note:
- Even if we generate HTML from JSON, we still sanitize as defense-in-depth.

## Autosave Strategy (Standard)

We will use a shared hook (web-only) for form-level autosave:

- Inputs:
  - `getPayload(): Payload`
  - `save(payload): Promise<void>`
  - `isDirty(): boolean`
  - `debounceMs`
- Behavior:
  - Debounced save after changes.
  - Flush on blur/unmount.
  - Skip syncing external value into editor while focused + dirty.

Reference implementation pattern:
- `apps/web/modules/saas/studio/components/home/widgets/stickies/sticky-note.tsx`

## Phases

### Phase 1 - Foundation (Shared Editor Package)

Goal: Create `packages/editor` with stable APIs and a minimal extension set.

Deliverables:
- `@repo/editor/core`:
  - schema registry + schema version
  - validate JSON
  - extract text
  - render JSON -> HTML
- `@repo/editor`:
  - `RichTextEditor` (full)
  - `LiteRichTextEditor` (composer)
  - `ReadOnlyRenderer`

Automated verification:
- `pnpm typecheck`
- `pnpm lint`
- (Optional) `pnpm build` (ensures package exports resolve)

Manual verification:
- Editor mounts without hydration issues.
- External value sync does not jump cursor.

### Phase 2 - Database (Discussions)

Goal: Add JSON + text columns without breaking existing traffic.

Changes:
- `packages/database/drizzle/schema/discussions.ts` add new columns.
- Generate/apply migrations.

Automated verification:
- `pnpm db:generate`
- `pnpm db:migrate`

Manual verification:
- Existing discussions still load.

### Phase 3 - API (Discussions + Messages)

Goal: Accept and store rich text JSON.

Changes:
- `packages/api/modules/discussions/schemas.ts` add `contentJson` fields.
- Procedures:
  - create/update discussion
  - create/update message
  - store JSON + derived text
  - maintain backward compat for `content` during rollout

Automated verification:
- `pnpm typecheck`

Manual verification:
- Invalid JSON is rejected.
- Unsafe links rejected.

### Phase 4 - Web UI (Discussions)

Goal: Replace textarea inputs and read-only rendering for discussions.

Changes:
- `apps/web/modules/saas/studio/components/discussions/discussion-form.tsx`
  - replace `content: string` with `contentJson`
  - use `Controller` to bind to editor
- Discussion pages:
  - render content using `ReadOnlyRenderer`
  - list preview uses derived `contentText`
- Message composer / replies:
  - use `LiteRichTextEditor`
  - submit-based (no autosave)

Automated verification:
- `pnpm build`
- If E2E is configured: `cd apps/web && pnpm e2e`

Manual verification:
- Create discussion works.
- Create message works.
- Read-only content matches edit output.

### Phase 5 - Security + Paste Hardening

Goal: Make it robust for production content.

Changes:
- Tighten JSON validation allowlist.
- Add sanitization for HTML rendering.
- Add limits on input size.

Manual verification:
- Paste from Google Docs/Notion produces acceptable result.

### Phase 6 - Optional Enhancements (Future)

Plane-inspired add-ons to consider when needed:
- Mentions using `@tiptap/suggestion` and relational mention storage.
- Slash commands menu.
- Attachments/images with custom nodes.

## Testing Strategy

Unit tests (new):
- `validateContentJson` (good/bad payloads)
- `extractText`
- `renderJsonToHtml` round-trip basics

E2E (Playwright) (new):
- Create discussion with formatting
- Create message with formatting
- Paste scenario sanity

Commands:
- `pnpm build`
- `cd apps/web && pnpm e2e`

## Living Progress Tracker (Update This During Development)

Planning / TODOs:
- [x] Phase 1 complete
- [x] Phase 2 complete
- [x] Phase 3 complete
- [x] Phase 4 complete
- [x] Phase 5 complete
- [ ] Release / rollout complete

Update protocol:
- After each PR that advances this effort, check off the relevant items and append an entry to the implementation log.
- If scope changes, update the "What We Are NOT Doing" section first, then adjust phases.

Implementation log:
- 2026-01-22: Phase 1 foundation landed (new `@repo/editor` package + core validation/extraction/render + basic React editors + unit tests)
- 2026-01-22: Phase 2 DB schema landed (add discussions/message `content_json`, `content_text`, `content_schema_version`; migration `0014_condemned_trauma.sql`)
- 2026-01-22: Phase 3 API landed (accept/store `contentJson` for discussions/messages; validate + derive `contentText`; backward-compatible `content`)
- 2026-01-22: Phase 4 web UI landed (discussion create uses `RichTextEditor`; detail/messages render with `ReadOnlyRenderer`; replies/composer use `LiteRichTextEditor`; previews prefer `contentText`)
- 2026-01-22: Phase 5 hardening landed (server-side JSON validation enforced; per-surface size limits; strict doc-type guards in web renderer)

## References

Plane (reference architecture, not to be copied wholesale):
- `plane/packages/editor` (central editor package)
- `plane/apps/web/core/components/editor/rich-text/description-input/root.tsx` (form-level autosave)
- `plane/apps/api/plane/utils/content_validator.py` (server-side sanitization allowlists)

This repo (evidence + patterns to follow):
- `apps/web/modules/saas/studio/components/home/widgets/stickies/sticky-editor.tsx` (TipTap setup + cursor-safe sync)
- `apps/web/modules/saas/studio/components/home/widgets/stickies/sticky-note.tsx` (debounced autosave + flush)
- `packages/database/drizzle/schema/discussions.ts` (current discussions storage)
- `packages/api/modules/discussions/schemas.ts` (current API contracts)
- `packages/api/modules/discussions/procedures/create-message.ts` (current message creation)
