# Submission parent review reconciliation

Read when: preparing Package 4 staging or production rollout, or repairing task/deliverable workflow states created by the former first-decision behavior.

## Safety contract

- Every run is scoped to one organization.
- Report mode never writes.
- Repair requires the exact hash from a reviewed report and the user ID of an owner or admin in that organization.
- The report hash rejects a repair when the organization-wide mismatch set changed before the run. Each row is locked and checked again immediately before its write; a row that changed during the run is skipped.
- For an approved parent, complete evidence means every current assignee's latest submission is approved and has a review timestamp. This proves the aggregate status, but not the transition time: assignment removal can make the parent approved after the remaining submissions were reviewed.
- A non-null approval timestamp on a parent whose aggregate status is already approved is preserved as the authoritative runtime transition time. Reconciliation never replaces it with a submission review timestamp.
- A row that should be approved but lacks an approval timestamp is reported for manual historical investigation and never repaired automatically. The repair never substitutes its execution time or infers the transition time from submission review times.
- Incomplete approval evidence is always reported for manual investigation, even when the parent already has an approved status and a non-null approval timestamp.
- Reopened parents are repaired to their canonical non-approved status and any stale approval timestamp is cleared.
- Every applied repair writes an attributed activity record.

## Staging rehearsal

Use the staging database that mirrors sanitized production data. Do not point these commands at production for the rehearsal.

```sh
pnpm submissions:reconcile-parent-review --report --organization-id ORGANIZATION_ID
```

Save and review the complete JSON output. Confirm the expected status, expected approval time, approval evidence, and `repairable` value for every mismatch. Keep the `reportHash`. An `approval_evidence_incomplete` or `approval_timestamp_missing` row needs historical investigation; do not substitute the repair execution time.

Run the reviewed repair with an owner/admin who approved the report:

```sh
pnpm submissions:reconcile-parent-review --repair-reviewed \
  --organization-id ORGANIZATION_ID \
  --reviewed-report-hash REPORT_HASH \
  --reviewed-by-user-id ADMIN_USER_ID
```

Run report mode again. A second reviewed repair against an unchanged clean report must apply nothing. Investigate every `requiresManualReview` row rather than editing its approval timestamp to the current time.

## Production sequence

1. Generate and archive the organization report.
2. Review it against submission/assignment history.
3. Run the same report and repair flow on the sanitized staging mirror.
4. Smoke-test task and deliverable review flows in both sibling approval orders.
5. Generate a fresh production report immediately before repair.
6. Repair using only that fresh reviewed hash.
7. Archive the before/after output and re-run report mode.
