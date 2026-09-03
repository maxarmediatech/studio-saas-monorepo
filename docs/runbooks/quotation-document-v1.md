# Quotation document v1 operations

read_when:
- Releasing or rolling back the document-v1 quotation wizard.
- Investigating quotation PDF, conversion, lead-promotion, or cleanup failures.
- Refreshing a sanitized staging database for quotation acceptance testing.

The product and data contract lives in
[`docs/plans/quotation-system-spec.md`](../plans/quotation-system-spec.md). This
runbook covers deployment and operational checks only.

## Rollout

Use this order independently in staging and production. Do not apply the terms
backfill ahead of the compatible application: old application schemas do not
recognize `quotation_terms` in unfiltered configuration responses such as
exports.

1. Verify the migration ledger and release preflight, including the current
   application version, database backup/restore readiness, and required storage
   configuration.
2. Apply the additive migrations through
   `0055_quotation_terms_configuration.sql`. Migration 0055 adds the enum value
   only; it does not create configuration rows visible to the old application.
3. Deploy the compatible API and web application commit with
   `QUOTATION_WIZARD_MODE=legacy`.
4. Apply `0056_quotation_terms_neutral_backfill.sql`. It is idempotent and adds
   a neutral 40/50/10 preset only for organizations without quotation terms.
5. Verify every existing organization has exactly one active default quotation
   terms preset and that no tenant-specific legal wording was introduced.
6. Run quotation terms create/edit/default/filter checks and an S3-backed
   quotation send/PDF smoke before enabling document-v1 writes.
7. Refresh sanitized staging. Seed organization-owned booking type, event type,
   and package configuration fixtures because the sanitizer removes production
   configuration wording.
8. Set `QUOTATION_WIZARD_MODE=document-v1` in staging and complete the quotation
   acceptance flow: draft, preview, send, accept, revise, and convert.
9. Confirm the synchronous quotation PDF send succeeds against private storage.
   Confirm the Trigger.dev task `cleanup-unreferenced-quotation-pdfs` is
   registered and succeeding before enabling document-v1 in production.
10. Enable `document-v1` for new production quotations. Existing legacy and
   document-v1 rows continue to dispatch by `documentVersion`, independent of
   the switch.

The compatibility window is after 0055 and before 0056. During this window the
old application remains safe because no `quotation_terms` rows exist. After 0056
has run, do not roll back to an application schema that omits the new enum value.

### Selectable PDF template rollout

Expose selection only through the authenticated server catalog. The web entry
points remain organization-permission gated: operational read for catalog and
preview, quote update for draft selection, and quote send for send/recovery.
There is currently no organization-scoped feature-flag service in this codebase;
do not substitute an environment variable or organization metadata convention.
That infrastructure gap must be resolved before a tenant-by-tenant rollout.

Classic v0 (`classic@2` internally) is the only active template for new drafts.
Classic v1 and Neutral remain retired in the immutable registry so historical
render intents and provenance can still resolve their exact renderer. Run the
minimal, normal, boundary, preview, and send checks before promotion. Reversal
is a compatible application deploy that changes catalog status only. Never
remove a renderer once its identity has been persisted.

## Acceptance checks

- Create a name-only lead and confirm conversion promotes the same client ID.
- Apply a configured package and verify price, description, and default
  deliverables in the draft, PDF, and converted booking.
- Create and edit a quotation terms preset, make it the default, filter it to a
  booking type, and verify invalid milestone counts, non-positive percentages,
  and totals other than 100 are rejected.
- Reorder delivery timelines and fixed clauses and verify their stable keys and
  order survive save and reload.
- Create a quotation and confirm its eligible default preset is copied exactly
  once with provenance. Manual edits must show Custom; Apply/Reapply and Clear
  must require confirmation before replacing non-empty content.
- Edit or deactivate the source preset and confirm existing drafts, sent PDFs,
  and acceptance evidence retain their copied terms. Confirm foreign-tenant
  preset references remain rejected while a removed same-tenant reference
  already present in a draft remains saveable.
- Convert an accepted quotation and verify only its payment milestones become a
  booking payment schedule; timelines, fixed clauses, and preset provenance stay
  quotation evidence.
- Complete an S3-backed send, download the stored PDF, and confirm the selected
  timelines, milestones, and clauses render in their saved order.
- In wizard and detail previews, switch between every active template and verify
  the prior iframe remains visible under progress until the replacement loads.
  Confirm preview URLs carry revision, template ID/version, and selection version.
- Force a stale selection write and confirm the 409 path refreshes authoritative
  quotation/presentation state. Then deactivate the selected catalog entry and
  confirm drafts require a replacement while immutable historical PDFs remain
  downloadable.
- Force a render failure and verify the quotation returns to draft, reports the
  failure, and can be sent again with the same template selection.
- Exercise all five event sides plus fixed and tentative timelines. Tentative
  booking events must remain off the calendar until dated.
- Confirm converted payment schedules have no fabricated due dates and are
  absent from overdue/reminder calculations.
- Download an older sent PDF after revision and compare its stored SHA-256 and
  bytes with the acceptance snapshot.
- Confirm manager/owner permissions and legacy v1 lifecycle regression tests.
- Execute the staging sanitizer against a disposable PostgreSQL clone, then
  verify document, normalized option/line-item, acceptance, branding, and PDF
  storage fields contain no production PII or object keys.

## PDF rendering, recovery, cleanup, and integrity

A document-v1 send persists a frozen render intent and renders in the same API
request while the quotation remains `draft`. The renderer uses only that frozen
source and presentation identity, verifies the private stored bytes, then
atomically completes the intent and moves the quotation from `draft` to `sent`.
A failed render leaves the quotation as `draft` and retains the incomplete
intent, so the same template selection can resume safely on the next send.
Existing failed intents retain
manual retry and return-to-draft actions for operational recovery. Never edit
intent source fields or attach an artifact manually.

Sent PDFs use private, content-addressed keys. Reads recompute SHA-256 and verify
the stored byte size before serving evidence. Integrity failures are availability
errors; they never trigger a replacement render.

The daily Trigger.dev task deletes only quotation PDF objects older than 24 hours
that are unreferenced by both quotes and acceptances. Its queue concurrency is
one. The authenticated cleanup route is an operator fallback, not the scheduler.
Review task logs for scanned, retained, and deleted counts after deployments.

## Rollback

Set `QUOTATION_WIZARD_MODE=legacy` to route only new quotation creation back to
the legacy editor. Do not roll back the expand migration or rewrite existing
document-v1 rows. Their stored documents, branding snapshots, PDFs, acceptance
evidence, and conversion provenance remain readable by the compatible backend.
Once migration 0056 has inserted quotation terms, any application rollback must
retain the compatible configuration schema; an older build that rejects
`quotation_terms` is not a safe rollback target.
