# Selectable quotation PDF templates: Five-PR implementation plan

Status: Approved implementation sequence supporting [Selectable quotation PDF templates for Stuwiz](./selectable-quotation-pdf-templates.md)

read_when:
- Starting or reviewing selectable quotation template implementation.
- Planning database, API, renderer, or quotation UI changes.
- Preparing rollout or pull-request acceptance criteria.

## 1. Delivery rule

Deliver this work in five separate PRs. Do not combine infrastructure, persistence, APIs, visual template design, and UI.

Order matters:

```text
Template foundation
→ Persistence and provenance
→ APIs and durable send pipeline
→ One approved new template
→ Stuwiz selection experience
```

The first implementation change is extraction of the existing renderer as immutable `classic@1`. It is not another visual redesign.

## 2. Shared persistence decision

Use one presentation row per quotation, not one row per document revision.

```ts
interface QuotationPresentation {
  quoteId: string; // primary key
  organizationId: string;
  templateId: string;
  templateVersion: number;
  selectionVersion: number;
  selectedBy: string;
  selectedAt: Date;
}
```

Stuwiz does not retain every overwritten draft document revision. Keeping presentation rows for missing source revisions would add false history and unnecessary cleanup.

Every presentation mutation still verifies:

- Current `documentRevision` from the quotation
- Current `selectionVersion` from the presentation row

Every send uses:

```text
quoteId:documentRevision:selectionVersion
```

as its idempotency key.

## 3. PR 1: Template foundation

### Scope

No visual or database changes.

- Extract the existing production renderer as immutable `classic@1`.
- Add a code-backed template registry.
- Define template, copy-profile, compatibility, and renderer types.
- Extract shared quotation formatting.
- Extract reusable semantic sections.
- Add the rendering-envelope preflight.
- Preserve the current PDF byte-for-byte where deterministic canonicalization permits.
- Keep the current template as the only active registry entry.

Suggested ownership:

```text
packages/api/modules/quotes/pdf/
  registry.ts
  types.ts
  copy-profile.ts
  preflight.ts
  semantic-model.ts
  templates/
    classic-v1/
```

### Tests

- Exact registry lookup by ID and version
- Active and retired compatibility behavior
- Unknown and unsupported version rejection
- Copy-profile version compatibility
- Rendering-envelope preflight
- Existing content and pagination regression tests
- Existing canonical byte-stability tests
- Stored hash and page-count regression tests

### Acceptance gate

- Existing quotation fixtures render the same PDF bytes where current canonicalization is deterministic.
- Any unavoidable byte difference is explained and approved before merge.
- Extracted semantic sections do not omit or reorder source facts.
- No new template or selection UI appears.

## 4. PR 2: Persistence and provenance

### Database additions

- `quotation_presentations`
- `quotation_pdf_render_intents`
- Template provenance attached to completed PDF evidence
- New `preparing` quotation status
- Database protections for presentation, frozen intent inputs, and completed provenance

`quotation_presentations` uses `quote_id` as its primary key. It does not contain `document_revision` as part of its identity.

`quotation_pdf_render_intents` freezes:

- Quote ID and version
- Document revision
- Selection version
- Source document and fingerprint
- Branding snapshot and fingerprint
- Template ID and version
- Copy-profile version
- Composer version
- Renderer version
- Idempotency key
- Lifecycle, attempt, task, and diagnostic data

### Application updates

Update all affected read and evidence paths:

- Quote detail schema
- Acceptance PDF snapshot
- Conversion provenance
- Cleanup reference discovery
- Activity records
- Existing PostgreSQL integrity tests

### Legacy evidence

Existing sent quotations must not receive invented template provenance.

- Preserve their existing immutable PDF evidence.
- Mark or interpret them as legacy evidence.
- Add exact template identity only if immutable historical data proves it.
- Never infer provenance merely because `classic@1` is now the default.

### Database invariants

- One presentation row per quotation
- Organization identity agrees across related rows
- Presentation cannot change while quotation is `preparing` or `sent`
- Frozen render-intent identity cannot change after insertion
- Completed provenance cannot update or delete
- One intent per idempotency key
- One immutable completed artifact per quote version

### Acceptance gate

- Migrations are reversible where project policy requires it.
- Existing quotation evidence remains readable and unchanged.
- PostgreSQL tests prove lifecycle, tenant, immutability, and cleanup invariants.
- No selection API or UI ships in this PR.

## 5. PR 3: APIs and durable synchronous send pipeline

### Procedures

Add authenticated procedures for:

- Listing active templates
- Reading the current presentation selection
- Selecting a template
- Starting a send
- Retrying a failed render
- Explicitly returning a failed render to draft

Every mutation verifies organization scope, permission, `documentRevision`, and `selectionVersion` where applicable.

A stale version returns `409 Conflict` with current selection identity.

### Send transaction

1. Lock quotation and presentation.
2. Verify document and selection versions.
3. Freeze document, branding, template, renderer, and fingerprints.
4. Create or resolve an idempotent render intent.
5. Commit the render intent while the quotation remains `draft`.
6. Render and store the frozen source in the same API request.
7. Atomically complete the intent and move the quotation to `sent`.

### Renderer

The synchronous renderer:

1. Claims the pending intent idempotently.
2. Runs rendering-envelope preflight.
3. Renders from the frozen input.
4. Canonicalizes the PDF.
5. Enforces page, duration, and byte limits.
6. Stores and verifies exact bytes.
7. Attaches immutable provenance.
8. Marks the intent completed.
9. Marks the quotation sent.

### Recovery

- A render failure leaves the quotation as `draft` and marks the intent
  `returned_to_draft`.
- The next send resumes the same frozen intent when document and selection
  identities still match.
- Manual retry and return-to-draft remain available for older failed intents.
- A later selection increments `selectionVersion`, producing a new idempotency
  key.

### Tests

- Concurrent selection updates
- Selection racing with send
- Duplicate send requests
- Synchronous render failure
- Same-selection resume after failure
- Renderer retry after partial failure
- Retry after storage failure
- Explicit failed-to-draft transition
- Immutable artifact attachment
- Cross-organization access denial

### Acceptance gate

- No request can send with stale document or selection state.
- Duplicate requests converge on one render intent and one artifact.
- A failed request leaves an editable draft and can resume safely.
- Existing direct-send behavior is migrated without weakening evidence guarantees.

## 6. PR 4: One approved better template

Implement only one new template.

Before renderer code begins, approve exact references for:

- Cover page
- Normal content page
- Participant and event presentation
- Package presentation
- Payment presentation
- Delivery and terms presentation
- Continuation page
- Minimal fixture output
- Normal fixture output
- Boundary fixture output

Rules:

- No invented copy.
- No design interpretation without an approved reference.
- No UI changes.
- No second new template in the same PR.
- Immutable fonts and assets with verified hashes.

Required validation:

- Content extraction
- Pagination and explicit page-count agreement
- Minimal, normal, and boundary fixtures
- Every rejection fixture
- Asset and font verification
- Visual review of every page
- Production-representative benchmarks
- Template manifest and compatibility tests

Acceptance gate:

- Product and design approve all reference pages.
- Boundary benchmark meets the documented envelope.
- Every required source fact is present.
- The template can be activated independently by organization.

## 7. PR 5: Stuwiz selection experience

Add the selector to the existing quotation preview step.

### Catalog behavior

- Use static thumbnails.
- Never render every template merely to display cards.
- TanStack Query manages template catalog and selection state.
- PDF bytes remain outside TanStack Query cache state.

### Selection and preview behavior

1. User chooses a template.
2. Persist the selection with expected document and selection versions.
3. On success, request the new PDF preview.
4. Keep the existing iframe visible while the new preview loads.
5. Display progress over the old preview.
6. Replace the iframe only after the new PDF is ready.

Preview URL:

```text
/api/studio/quotations/{quoteId}/pdf
  ?revision={documentRevision}
  &templateId={templateId}
  &templateVersion={templateVersion}
  &selectionVersion={selectionVersion}
```

Requirements:

- Authenticated route
- `Cache-Control: private, no-store`
- No Next.js cache tags
- No `use cache` for customer PDF bytes
- Explicit unsupported-template errors
- `409 Conflict` refreshes current selection
- No white iframe flash

### Detail-page lifecycle

Show:

- `Preparing PDF`
- Render progress where available
- Retry failed render
- Explicit return to draft
- Non-editable sent state
- Immutable final PDF download

### Acceptance gate

- Selection persists before preview changes.
- Two-browser conflicts recover without silent overwrite.
- Preview identity matches the persisted selection.
- Preparing, retry, failure, and sent states are observable.
- Feature flag can disable the selector without affecting existing send behavior.

## 8. Rollout

1. Keep `classic@1` as the default.
2. Deploy foundation, persistence, and APIs to staging with only `classic@1` active.
3. Verify existing quotations remain identical.
4. Activate one approved new template for the staging organization.
5. Test conflicts, duplicate sends, retries, recovery, and immutable downloads.
6. Enable the selector in production behind an organization feature flag.
7. Add more templates only after the first succeeds in production.

## 9. Pull-request boundaries

| PR | Database | API | Visual template | UI |
| --- | --- | --- | --- | --- |
| 1. Foundation | No | Internal registry only | Existing renderer extraction | No |
| 2. Persistence | Yes | Schema/read-model updates only | No | No |
| 3. Pipeline | Uses PR 2 | Yes | No | No |
| 4. Template | No new infrastructure | Registry activation only | One | No |
| 5. Experience | No new domain tables | UI integration only | No | Yes |

If a PR requires substantial work from a later column, stop and split it rather than expanding scope.

## 10. Implementation start

Begin with PR 1 and prove `classic@1` extraction does not alter existing output. Do not begin with a new visual template or selector UI.
