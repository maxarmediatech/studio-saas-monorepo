# Quotation document v1 operations

read_when:
- Releasing or rolling back the document-v1 quotation wizard.
- Investigating quotation PDF, conversion, lead-promotion, or cleanup failures.
- Refreshing a sanitized staging database for quotation acceptance testing.

The product and data contract lives in
[`docs/plans/quotation-system-spec.md`](../plans/quotation-system-spec.md). This
runbook covers deployment and operational checks only.

## Rollout

1. Apply migrations `0054_thankful_forgotten_one.sql` and
   `0055_quotation_terms_configuration.sql` before enabling new writes.
2. Deploy the compatible API and web application with
   `QUOTATION_WIZARD_MODE=legacy`.
3. Refresh sanitized staging. Seed organization-owned booking type, event type,
   and package configuration fixtures because the sanitizer removes production
   configuration wording.
4. Set `QUOTATION_WIZARD_MODE=document-v1` in staging and complete the quotation
   acceptance flow: draft, preview, send, accept, revise, and convert.
5. Confirm the daily Trigger.dev task `quotation-pdf-cleanup` is registered and
   succeeding before enabling document-v1 in production.
6. Enable `document-v1` for new production quotations. Existing legacy and
   document-v1 rows continue to dispatch by `documentVersion`, independent of
   the switch.

## Acceptance checks

- Create a name-only lead and confirm conversion promotes the same client ID.
- Apply a configured package and verify price, description, and default
  deliverables in the draft, PDF, and converted booking.
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

## PDF cleanup and integrity

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
