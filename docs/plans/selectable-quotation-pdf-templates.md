# Proposal: Selectable quotation PDF templates for Stuwiz

Status: Revised proposal for stakeholder review

read_when:
- Planning quotation PDF designs or template selection.
- Changing quotation preview, rendering, send, or evidence storage.
- Preparing future compatibility with the separate visual document editor.

## 1. Executive summary

Stuwiz should support multiple selectable quotation PDF templates without depending on the separate visual editor.

The near-term experience is:

1. A user creates a quotation in Stuwiz.
2. Stuwiz displays approved PDF templates.
3. The user previews and selects a template.
4. Stuwiz persists that selection atomically while verifying the current document revision.
5. At send time, Stuwiz freezes the quotation, branding, template, and renderer identities in one transaction.
6. Stuwiz renders and stores the exact PDF through the existing evidence pipeline.

Users do not need free-form PDF editing in this phase.

The separate editor remains a future integration. The systems should share stable contracts, semantic identities, template metadata, and conformance fixtures, but Stuwiz should not depend on editor-specific state or unfinished editor APIs.

## 2. Current scope

Stuwiz should support:

- A catalog of approved, versioned PDF templates.
- One explicit default template for backward compatibility.
- Authenticated previews using real quotation data.
- Selecting a template per draft quotation.
- Atomic selection persistence with optimistic concurrency.
- Immutable template versions.
- Send-time locking and idempotency.
- Explicit pagination for short and long quotations.
- Template identity in preview URLs, cache keys, and evidence provenance.
- Content, boundary, pagination, visual, and concurrency tests.
- The existing timeout, size, canonicalization, integrity, and storage safeguards.

The current phase does not include:

- Redirecting users to the separate editor.
- Free-form PDF editing.
- Dragging or resizing PDF elements.
- An interactive template builder.
- Editor composition sessions.
- Editor authentication or finalization callbacks.
- Synchronizing editor changes with quotation revisions.

## 3. Product goal

Users should be able to choose how a quotation looks without changing what the quotation says.

They should be able to:

- Create the quotation once.
- Compare approved templates.
- Preview each template with the real quotation.
- Select or change the template while the quotation is a draft.
- Send the selected template without changing business content.
- Retrieve older sent quotation versions exactly as sent.

Design should improve hierarchy, scanning, and readability. Templates must not invent marketing copy or omit business information.

## 4. Proposed user experience

### 4.1 Create the quotation

The existing Stuwiz workflow remains authoritative for:

- Client information
- Events
- Packages
- Coverage
- Deliverables
- Prices
- Recommended package
- Payment percentages
- Delivery timelines
- Terms
- Validity and revision

### 4.2 Choose a template

The quotation preview page displays the active template catalog.

Each option includes:

- Display name
- Plain-language description
- Static catalog thumbnail
- Template version where needed for support
- Selected state
- Loading and failure states

The catalog must not render every template merely to show its cards. Template names and the launch catalog require separate product and design approval.

### 4.3 Preview

Selecting a template first persists the selection, then requests an authenticated preview with explicit identity:

```text
/api/studio/quotations/{quoteId}/pdf
  ?revision={documentRevision}
  &templateId={templateId}
  &templateVersion={templateVersion}
  &selectionVersion={selectionVersion}
```

The route remains authenticated and uses `Cache-Control: private, no-store`. Do not use Next.js cache tags or `use cache` for customer PDF bytes. TanStack Query manages catalog and selection state, not the PDF artifact.

The URL, server cache key, response ETag, and observability fields include document revision, selection version, and template identity. Renderer version and source fingerprint also participate in server identity.

Keep the previous iframe visible until the new PDF loads. Show progress over the old preview instead of flashing white. Unsupported or retired template versions return an explicit error; preview never silently falls back.

### 4.4 Persist selection

Choosing a template updates one presentation row for the quotation, not `QuotationDocumentV1` and not one row per draft revision.

Every mutation verifies both expected `documentRevision` and `selectionVersion`. A stale update returns `409 Conflict` with the current selection, and the UI refreshes instead of overwriting another user’s choice.

### 4.5 Send

Send must not trust template identity from an old browser preview.

1. Lock the quotation and presentation rows.
2. Verify document and selection versions.
3. Freeze document, branding, template, renderer, and fingerprints.
4. Create an idempotent render intent.
5. Keep the quotation as `draft` while rendering in the API request.
6. Render, store, and verify the frozen PDF.
7. Atomically attach the PDF, complete the intent, and mark the quotation
   `sent`.

The render-intent row preserves frozen input, idempotency, and provenance. A
failure leaves the quotation as a draft and retains the intent. The next send
resumes that intent when the document and selection identities still match.

## 5. Template model

A template is a versioned presentation policy, not another quotation document.

```ts
interface QuotationPdfTemplateManifest {
  id: string;
  version: number;
  label: string;
  description: string;
  quotationContractVersion: number;
  copyProfileVersion: number;
  composerVersion: number;
  status: "active" | "retired";
  supportedFeatures: readonly string[];
}
```

A template defines:

- Page dimensions and margins
- Typography, colors, and spacing
- Header, footer, and continuation behavior
- Participant, event, package, payment, delivery, and terms layouts
- Pagination and split rules
- Approved labels
- Required fonts and assets
- Supported contract features

Published template versions are immutable. Material changes create a new version. Retired versions remain resolvable for existing evidence, but cannot be newly selected.

## 6. Copy and content policy

Quotation facts and wording remain source-backed.

Templates may:

- Change visual hierarchy.
- Use approved section labels.
- Emphasize source-designated information.
- Add page numbers and quotation metadata.

Templates must not:

- Invent promotional claims.
- Rewrite prices, dates, percentages, or terms.
- Hide required package scope.
- Omit data because it does not fit the preferred page count.
- silently truncate long content.

Approved labels should come from one versioned copy profile rather than independent template prose.

## 7. Atomic persistence and concurrency model

Template selection should be stored in one dedicated row per quotation:

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

Required invariants:

- One current selection per quotation.
- No presentation rows for overwritten draft revisions.
- Selection references an immutable template version.
- Every mutation verifies expected `documentRevision` and `selectionVersion`.
- Selection and quotation status checks occur in one transaction.
- Send locks both records before creating the frozen render intent.
- The idempotency key is `quoteId:documentRevision:selectionVersion`.
- Render retries reuse the frozen snapshot and cannot pick up a newer selection.
- Successful send attaches exactly one immutable PDF artifact to the quote version.

Detailed transaction guidance is in the [technical appendix](./selectable-quotation-pdf-templates-technical-appendix.md).

## 8. Preview identity and immutable PDF provenance

Preview identity must include:

- Quotation ID
- Document revision
- Selection version
- Template ID
- Template version
- Source fingerprint
- Branding fingerprint
- Copy-profile version
- Composer version
- Renderer version

The authenticated browser URL contains only non-sensitive routing identity. Server-side identity and any future signed preview claims must include the complete identity.

The immutable sent-PDF evidence record must preserve:

```ts
interface QuotationPdfProvenance {
  quotationId: string;
  quotationVersion: number;
  documentRevision: number;
  selectionVersion: number;
  sourceFingerprint: string;
  brandingFingerprint: string;
  templateId: string;
  templateVersion: number;
  copyProfileVersion: number;
  composerVersion: number;
  rendererVersion: string;
  artifactSha256: string;
  artifactByteSize: number;
  pageCount: number;
  storageKey: string;
  renderedAt: string;
}
```

This manifest belongs beside the immutable stored PDF. PDF metadata may repeat non-sensitive values, but it is not the authoritative provenance record.

Existing sent quotations must not receive invented template provenance. They remain legacy evidence unless exact template identity can be proven from immutable historical data.

## 9. Ownership boundaries

| Concern | Current owner | Future editor phase |
| --- | --- | --- |
| Quotation facts, validation, revisions, and wording | Stuwiz | Stuwiz remains authoritative |
| Quotation source contract | Stuwiz | Published by Stuwiz for editor consumption |
| Template selection for a quotation | Stuwiz | Stuwiz remains authoritative |
| Stuwiz-native template manifests and render code | Stuwiz | Remain supported for non-edited PDFs |
| Send lifecycle, acceptance, and evidence storage | Stuwiz | Stuwiz remains authoritative |
| Editor canonical document and layer model | None in this phase | Separate editor |
| Editor-native layouts, edits, history, and export | None in this phase | Separate editor |
| Cross-application contract and conformance fixtures | Stuwiz defines source; both validate compatibility | Jointly versioned integration boundary |
| Final edited artifact | None in this phase | Editor renders; Stuwiz verifies, stores, and sends exact bytes |

A shared template identity does not require both renderers to share implementation code or promise pixel-identical output. It means both systems agree on the design family, source semantics, versioning, and required content. Renderer-specific implementation identity remains explicit.

Stuwiz must not store Fabric JSON, canvas coordinates, editor history, or editor tokens during this phase.

## 10. Rendering limits and fixture boundaries

The quotation schema’s absolute data limits are broader than a practical synchronous PDF rendering guarantee. The renderer therefore needs a separate enforced support envelope.

### 10.1 Launch rendering envelope

The initial support envelope is:

| Dimension | Enforced limit |
| --- | ---: |
| Participants | 10 |
| Events | 20 |
| Packages | 10 |
| Coverage rows across all packages | 100 |
| Deliverables across all packages | 200 |
| Payment milestones | 3 |
| Delivery timeline clauses | 20 |
| Fixed terms | 30 |
| Characters in one rendered prose field | 5,000 |
| Aggregate rendered text | 100,000 characters |
| Serialized render input | 1 MiB |
| Decoded branding logo | 2 MiB |
| Generated PDF pages | 50 |
| Render duration | 15 seconds |
| Final PDF size | 20 MiB |

These are rendering limits, not silent truncation rules. Preflight rejects unsupported input with a clear actionable error before send.

The 15-second timeout and 20 MiB PDF limit already exist. The remaining limits must be implemented and benchmarked before new templates are marked production-ready. If benchmark results require a lower envelope, update the limits deliberately, document the decision, and apply it consistently to preview and send.

Detailed counting rules, benchmark gates, queue behavior, and fixtures: [Selectable quotation PDF templates — rendering limits](./selectable-quotation-pdf-rendering-limits.md).

### 10.2 Fixture boundaries

Each template requires:

- **Minimal:** one participant, event, package, coverage row, deliverable, and valid payment plan.
- **Normal:** representative multi-participant, multi-event, and multi-package data with ordinary text lengths.
- **Boundary:** every launch count limit, aggregate text close to 100,000 characters, long unbroken tokens, maximum supported logo, and output below 50 pages.
- **Rejection:** one fixture over each aggregate/count limit, one over the page limit, oversized branding, timeout simulation, and oversized PDF simulation.

A template passes only if all supported fixtures preserve every required fact without clipping, overlap, or omission, and every rejection fixture fails before immutable evidence is created.

## 11. Rendering architecture and future compatibility

The existing Stuwiz renderer remains the production foundation. New templates share its:

- Validation
- Explicit pagination
- Canonicalization
- Timeout
- Integrity checks
- Private storage
- Immutable evidence handling

The internal flow is:

```text
QuotationDocumentV1
        ↓
Rendering-envelope preflight
        ↓
Semantic quotation sections
        ↓
Immutable template layout policy
        ↓
Explicit page plan
        ↓
React PDF rendering
        ↓
Canonicalization and integrity checks
        ↓
Stored immutable PDF and provenance
```

To limit future divergence:

- Keep `QuotationDocumentV1` authoritative in Stuwiz.
- Use stable semantic field identities.
- Version template manifests, copy profiles, and renderer implementations.
- Keep design tokens structured where practical.
- Reuse renderer-neutral source fixtures later in the editor.
- Publish or generate the Stuwiz contract when editor integration begins.
- Do not introduce editor-specific persistence now.

## 12. Implementation sequence

Implementation is split into five independent PRs:

1. Template foundation and immutable `classic@1`; no visual change.
2. Presentation persistence, render intents, and provenance.
3. APIs and the durable synchronous send pipeline.
4. One approved new template with complete references and validation.
5. The Stuwiz selection, preview, progress, retry, and failure experience.

Do not combine infrastructure, UI, and visual template design. The detailed scope, dependencies, acceptance gates, and rollout order are in [Selectable quotation PDF templates — implementation plan](./selectable-quotation-pdf-templates-implementation-plan.md).

## 13. Validation requirements

Every template must prove:

- All source-backed facts are present.
- Coverage references the correct events.
- Prices and allocated payments are correct.
- Zero-percentage milestones are excluded consistently.
- Long content creates pages instead of clipping.
- Preview and send resolve the same identity.
- Stale selection writes return conflicts.
- A selection change during rendering prevents stale PDF attachment.
- Duplicate send requests resolve to one frozen intent.
- Failed renders leave an editable draft and can resume safely.
- Retries use the same template and source snapshot.
- Stored hash, byte size, page count, and provenance match the artifact.
- Unsupported inputs fail before storage or send.

Visual review includes every page, not only the cover.

## 14. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Stale browser selection wins | Optimistic concurrency and `409 Conflict` |
| Selection changes during send | Row locks and frozen render intent |
| Duplicate send creates different PDFs | `quoteId:documentRevision:selectionVersion` and unique render intent |
| Preview cache serves another template | Full identity in URL, cache key, and ETag |
| Template update changes old evidence | Immutable template versions and provenance |
| Valid schema input overwhelms renderer | Separate enforced rendering envelope |
| Long content is silently omitted | Preflight, explicit pagination, and boundary fixtures |
| Editor and Stuwiz drift | Ownership table, source contract, semantic IDs, and conformance fixtures |
| Future editor output replaces evidence incorrectly | Stuwiz verifies and stores exact finalized bytes |

## 15. Decisions required before implementation

1. Approve the Stuwiz-only near-term scope.
2. Approve the atomic persistence and send-time locking model.
3. Approve the rendering envelope or request benchmark-based adjustments.
4. Approve Stuwiz as owner of quotation source, selection, send, and evidence.
5. Approve the separate editor as future owner of editable scene state and edited rendering.
6. Approve immutable template and renderer provenance.
7. Approve plain source-backed copy rules.
8. Approve template names and launch catalog separately from this architecture.
9. Approve the five-PR implementation and staged feature-flag rollout.

## 16. Conclusion

The architecture provides a sound foundation for selectable quotation PDFs inside Stuwiz while preserving a practical path to future editor integration.

Implementation begins with extracting the current renderer as immutable `classic@1`, not with visual redesign. Infrastructure, persistence, APIs, one approved template, and UI ship as separate PRs. Existing sent evidence remains legacy unless its template provenance can be proven exactly.
