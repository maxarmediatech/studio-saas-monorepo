# Task-driven deliverables release note

## Operator action before migration

Migration `0046` converts the legacy `deliverables.delivered_at` value into the
new internal-completion timestamp. It now aborts if any legacy timestamp belongs
to a deliverable whose system workflow is not `approved`; investigate those rows
before retrying the migration.

```sql
SELECT id, organization_id, workflow_status, delivered_at
FROM deliverables
WHERE delivered_at IS NOT NULL
  AND workflow_status <> 'approved';
```

## User-visible change

Internal approval and client delivery are now separate events. Existing
approval timestamps move to `completedAt`; delivered counts restart from
explicit client-delivery actions. Tell studio operators before rollout so the
corrected count is not mistaken for lost deliverables.

Ordinary task links are informational: task and deliverable statuses and
assignees remain independent. Convert to Task is the explicit path that
transfers assignments and enables task-driven production workflow. Shoots do
not drive deliverable status.
