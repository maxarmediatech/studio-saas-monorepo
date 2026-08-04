# Quotation terms configuration

read_when:
- Changing quotation agreement content, presets, PDF evidence, or quote conversion.
- Changing configuration metadata validation or booking-type filtering.

## Contract

`quotation_terms` configurations are organization-owned named presets. One active
preset is the default. `bookingTypeFilter` can limit a preset to one booking type.
Metadata is a versioned structured object, never a rich-text agreement blob:

- `schemaVersion: 1`
- `deliveryTimelines`: ordered `{ key, text }` rows
- `paymentMilestones`: exactly three `{ key, label, percentage, timing }` rows;
  each positive and totaling exactly 100.00%
- `fixedTerms`: ordered `{ key, text }` rows

The neutral seed contains no studio-specific legal wording. It contains only the
existing 40/50/10 payment schedule.

## Copy and evidence semantics

A new document-v1 quotation copies the eligible default preset once. The
quotation stores an optional configuration provenance snapshot
(`id`, `key`, `label`, `metadataVersion`), but its copied timeline, milestone,
and clause rows are the source of truth. Editing or deleting a configuration
cannot live-update a draft, sent PDF, acceptance snapshot, or historical quote.

Manual edits clear provenance and appear as Custom. Selecting a preset does not
change the quotation; Apply/Reapply is explicit and confirms replacement of
non-empty content. Clear removes timelines and fixed clauses and restores the
neutral 40/50/10 schedule.

Configuration references are tenant-validated on quote creation and save.
References already present in the previous version of the same draft are
grandfathered so a deleted/deactivated preset does not strand that draft.

## Conversion boundary

Only copied payment milestones enter booking blueprint v2 and materialize as
payment schedules. Delivery timelines, fixed clauses, and preset provenance stay
quotation/acceptance evidence only.

## Release compatibility

Migration 0055 adds the `quotation_terms` enum value without creating rows. The
compatible application must be deployed before migration 0056 inserts neutral
presets, because older application schemas can reject the new type in unfiltered
configuration responses. Apply 0056 only after the compatible deployment, then
verify one active default preset per existing organization and complete the
S3-backed send/PDF smoke. The exact staging and production sequence is maintained
in the [quotation operations runbook](../runbooks/quotation-document-v1.md).
