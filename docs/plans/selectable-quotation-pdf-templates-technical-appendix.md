# Selectable quotation PDF templates: Technical appendix

Status: Supporting detail for [Selectable quotation PDF templates for Stuwiz](./selectable-quotation-pdf-templates.md)

read_when:
- Implementing template selection or quotation PDF rendering.
- Defining persistence, concurrency, provenance, or rendering limits.
- Preparing future integration with the separate visual document editor.

## 1. Architectural boundary

The near-term implementation stays entirely inside Stuwiz.

```text
QuotationDocumentV1
        ↓
Rendering-envelope preflight
        ↓
Semantic quotation sections
        ↓
Immutable template manifest and layout
        ↓
Explicit page plan
        ↓
React PDF rendering
        ↓
Canonicalization and integrity checks
        ↓
Immutable PDF and provenance manifest
```

The existing production service remains responsible for timeout, size checks, canonicalization, hashing, storage, and immutable evidence.

The quotation business document must not contain template IDs, coordinates, colors, or page breaks. Template selection is separate presentation state.

## 2. Template registry

Each template publishes immutable machine-readable metadata.

```ts
interface QuotationPdfTemplateManifest {
  id: string;
  version: number;
  label: string;
  description: string;
  owner: "stuwiz";
  quotationContractVersion: number;
  copyProfileVersion: number;
  composerVersion: number;
  rendererVersion: string;
  status: "active" | "retired";
  supportedFeatures: readonly string[];
  fonts: readonly QuotationTemplateFont[];
  assets: readonly QuotationTemplateAsset[];
}
```

Registry operations include:

- Resolve an exact ID and version.
- List versions active for new selection.
- Resolve retired versions for historical provenance.
- Validate contract and feature compatibility.
- Provide preview-thumbnail metadata.
- Resolve the explicit backward-compatible default.

Rules:

- IDs are stable lowercase identifiers approved with the template.
- Published versions are immutable.
- Material changes create a new version.
- Display-name changes do not rewrite historical provenance.
- A retired version cannot be newly selected.
- Send never silently substitutes another version.

No template names or launch catalog are prescribed by this architecture.

## 3. Persistence model

Use one presentation row per quotation:

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

Recommended constraints:

```text
PRIMARY KEY (quote_id)
FOREIGN KEY (quote_id, organization_id) → quotations (id, organization_id)
CHECK (selection_version > 0)
```

Stuwiz overwrites draft source revisions, so presentation history must not create rows for revisions whose documents no longer exist. Concurrency still compares the quotation’s current `documentRevision` with the presentation’s `selectionVersion`.

The code-backed registry is validated inside the transaction before commit. Existing drafts should be backfilled with exact `classic@1` identity. If backfill is not possible, send materializes that exact selection before freezing the intent. A mutable implicit default must never determine historical output.

## 4. Atomic selection update

The selection endpoint requires:

```ts
interface SelectQuotationTemplateInput {
  quoteId: string;
  expectedDocumentRevision: number;
  expectedSelectionVersion: number | null;
  templateId: string;
  templateVersion: number;
}
```

Transaction sequence:

```text
BEGIN

1. SELECT quotation FOR UPDATE.
2. Verify organization scope and edit permission.
3. Verify quotation status is editable.
4. Verify documentRevision equals expectedDocumentRevision.
5. SELECT the quotation’s single presentation row FOR UPDATE.
6. Verify selectionVersion equals expectedSelectionVersion.
7. Resolve exact template ID/version and compatibility.
8. INSERT or UPDATE presentation; increment selectionVersion.
9. Record selectedBy and selectedAt.

COMMIT
```

Failure behavior:

- Stale document or selection version → `409 Conflict` with current identity.
- Unknown or incompatible template → validation error.
- Retired template selected for a new draft → validation error.
- Non-editable quotation → lifecycle conflict.
- No partial write when any check fails.

If quotation content and template selection are saved in one client action, both updates belong in the same transaction. The API must not save quotation content and then fail to save template selection, or vice versa.

## 5. Send-time concurrency

Send accepts the client’s expected `documentRevision` and `selectionVersion` but resolves authoritative data from the database.

Use a consistent lock order to avoid deadlocks:

```text
quotation row
→ presentation row
→ existing send/render intent row
```

Transaction sequence:

```text
BEGIN

1. Lock quotation.
2. Verify tenant, permission, expected revision, and sendable status.
3. Lock presentation selection.
4. Verify expected selectionVersion.
5. Resolve exact immutable template manifest.
6. Snapshot quotation source and calculate sourceFingerprint.
7. Snapshot branding and calculate brandingFingerprint.
8. Freeze copyProfileVersion, composerVersion, and rendererVersion.
9. Create or resolve the render intent using `quoteId:documentRevision:selectionVersion`.
10. Leave the quotation as `draft` while the request renders.

COMMIT

11. Render, store, and verify the frozen PDF in the same API request.
12. Atomically complete the intent and transition the quotation to `sent`.
```

The render intent should contain:

```ts
interface FrozenQuotationRenderIntent {
  id: string;
  quotationId: string;
  quotationVersion: number;
  documentRevision: number;
  selectionVersion: number;
  sourceDocument: QuotationDocumentV1;
  sourceFingerprint: string;
  branding: QuotationBrandingSnapshotV1;
  brandingFingerprint: string;
  templateId: string;
  templateVersion: number;
  copyProfileVersion: number;
  composerVersion: number;
  rendererVersion: string;
  idempotencyKey: string;
  status:
    | "pending"
    | "rendering"
    | "failed"
    | "returned_to_draft"
    | "completed";
}
```

Required behavior:

- A unique constraint prevents more than one intent for the idempotency key.
- Duplicate requests return or resume the existing intent.
- Render retries use the frozen intent, never current draft state.
- A selection change during rendering makes stale artifact attachment fail.
- A failed render marks the intent `returned_to_draft` while the quotation stays
  editable as a draft.
- The next send resumes the same intent when document and selection identities
  still match.
- Choosing another template then increments `selectionVersion` and creates a new idempotency key on the next send.
- Successful completion attaches exactly one immutable artifact and changes
  `draft` to `sent`.

## 6. Preview identity

Authenticated draft preview route:

```text
GET /api/studio/quotations/{quoteId}/pdf
  ?revision={documentRevision}
  &templateId={templateId}
  &templateVersion={templateVersion}
  &selectionVersion={selectionVersion}
```

The URL contains no customer information. Authentication and tenant authorization are still mandatory.

Server-side preview identity includes:

```text
quoteId
documentRevision
selectionVersion
sourceFingerprint
brandingFingerprint
templateId
templateVersion
copyProfileVersion
composerVersion
rendererVersion
```

Requirements:

- Browser response uses `Cache-Control: private, no-store` unless a reviewed private-cache policy replaces it.
- Any server memoization key contains the complete identity.
- ETag derives from the complete identity, not quote ID alone.
- Logs include template ID/version, document revision, and selection version, but not raw customer content.
- Unsupported template identity returns an explicit error.
- Preview is never accepted as evidence.
- Send resolves its own frozen identity instead of trusting preview query parameters.

If a future signed preview URL is introduced, the full identity and expiry belong in signed claims. Changing any identity field invalidates the signature.

## 7. Immutable artifact provenance

The completed artifact record should preserve:

```ts
interface QuotationPdfProvenance {
  renderIntentId: string;
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

The provenance row and stored PDF are immutable after successful attachment. Existing sent quotations remain legacy evidence unless exact template identity can be proven from immutable historical data; migrations must not invent provenance.

Database evidence is authoritative. PDF metadata may repeat non-sensitive identifiers, but metadata must not be used to reconstruct missing provenance.

Verification sequence:

1. Render and canonicalize bytes.
2. Enforce page and byte limits.
3. Calculate SHA-256 and byte size.
4. Store bytes privately.
5. Verify stored bytes where the current pipeline requires it.
6. Atomically attach storage identity and provenance to the frozen intent and quote version.
7. Mark the intent complete and the quotation `sent`.

A failure before attachment must not create a sent quotation with missing or partial evidence.

Database protection should enforce:

- Presentation rows cannot be changed or deleted after their quotation is sent.
- Frozen render-intent input and identity columns cannot change after insertion; only lifecycle, attempt, task, and diagnostic columns may transition.
- Completed PDF provenance cannot be updated or deleted.
- Organization identity must agree across quotation, presentation, intent, and artifact references.
- Application-level checks remain necessary, but database integrity tests must prove these invariants.

## 8. Shared semantic primitives

Templates may arrange information differently, but should reuse semantic rendering primitives:

- Page header and footer
- Quotation identity
- Participants
- Events
- Packages
- Coverage
- Deliverables
- Payment milestones
- Delivery timelines
- Terms
- Continuation headings

Templates must not duplicate money formatting, date formatting, source validation, payment allocation, integrity, or evidence storage.

Stable semantic identities include:

```text
quote.title
quote.number
quote.validUntil
participant.{participantKey}.name
event.{eventKey}.date
event.{eventKey}.location
package.{packageKey}.price
package.{packageKey}.coverage.{coverageKey}
package.{packageKey}.deliverable.{deliverableKey}
payment.{milestoneKey}.timing
term.{termKey}.text
```

Use stable source keys rather than array indexes or display labels.

## 9. Copy profile and design tokens

Visual layouts consume one versioned copy profile. They may position approved labels differently but must not independently rewrite them.

Portable design configuration should include, where practical:

- Colors
- Font identities and immutable font assets
- Type scale
- Spacing
- Borders and radii
- Page dimensions
- Approved labels
- Required image assets and hashes

Complex pagination may remain code-based. The goal is not a universal declarative layout language; it is to keep important compatibility inputs visible and versioned.

## 10. Rendering limits and fixtures

The business schema’s absolute limits are broader than a realistic synchronous PDF guarantee. Preview and send therefore share a separately enforced rendering envelope covering aggregate counts, text volume, input bytes, branding assets, page count, active render duration, and final PDF bytes.

Unsupported input fails preflight with an actionable error. Content is never truncated to satisfy a template.

The complete limits, counting rules, benchmark gate, queue policy, and fixture definitions are specified in [Selectable quotation PDF templates: Rendering limits](./selectable-quotation-pdf-rendering-limits.md).

## 11. Ownership between applications

### Stuwiz owns

- Quotation business facts and validation
- `QuotationDocumentV1` and its revisions
- Source-backed copy
- Template selection for each quotation
- Stuwiz-native template manifests and React PDF implementations
- Send lifecycle and idempotency
- Acceptance and immutable evidence storage
- Verification of any future editor artifact

### The separate editor owns, when integrated

- Its canonical editable document model
- Editor-native layout implementations
- Layer state, user edits, history, and document revisions
- Editor preview and export fidelity
- Final rendering of an edited composition

### Shared integration boundary

- Versioned Stuwiz source contract
- Semantic field identities
- Source fingerprints
- Design-family mapping where needed
- Renderer-neutral fixtures
- Content conformance assertions
- Finalization provenance contract

Stuwiz template IDs belong to Stuwiz-native implementations. Future editor layout IDs belong to editor-native implementations. If both represent the same design family, map them through an explicit shared `designFamilyId`; do not pretend one implementation version describes both renderers.

Future edited output is rendered once by the editor. Stuwiz then verifies and stores those exact bytes. Stuwiz does not reverse-engineer the PDF or re-render the edited document.

## 12. Future editor boundary

Stuwiz stores none of the following in the current phase:

- Fabric JSON
- Canvas coordinates
- Editor layer history
- Editor composition IDs
- Editor tokens
- Editor-specific export state

When integration begins, publish or generate the Stuwiz quotation contract rather than maintaining a manually copied schema.

The future editor should compose from source JSON and template mapping, not import an existing PDF as editable source. PDFs do not reliably preserve semantic fields, repeaters, source ownership, or layer relationships.

## 13. Conformance requirements

Every Stuwiz template must prove:

- Preview and send use the same source and template identity.
- Every required business fact is rendered.
- Source relationships remain correct.
- Pagination is deterministic for a frozen input.
- Boundary input remains inside the operational limits.
- Unsupported input fails before rendering or storage where possible.
- Stale updates cannot overwrite newer selection.
- Selection cannot change after send starts.
- Duplicate sends produce one frozen intent.
- Retries preserve source and template identity.
- Stored bytes match SHA-256, byte size, and page count.

Future editor conformance should reuse source fixtures and content assertions. Pixel identity across different renderers is not required unless explicitly promised for a specific design family.

## 14. Summary

The near-term feature remains Stuwiz-native template selection and PDF generation.

Implementation safety depends on:

- Atomic presentation persistence
- Send-time locking and idempotency
- Complete preview identity
- Immutable PDF provenance
- Explicit application ownership
- Enforced rendering limits
- Concrete boundary and rejection fixtures

These decisions allow Stuwiz to ship independently while preserving a controlled path to future editor integration.

Delivery sequence: [Selectable quotation PDF templates — five-PR implementation plan](./selectable-quotation-pdf-templates-implementation-plan.md).
