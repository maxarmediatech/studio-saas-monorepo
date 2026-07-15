# WhatsApp Module Implementation Plan

## Overview
Building a WhatsApp automation module for Studio SaaS that can be extracted as a standalone SaaS later. All WhatsApp packages have zero studio imports to enable extraction.

## Architecture

### Package Structure
```
packages/
├── whatsapp-core/       # Domain types, events, commands, provider ports
├── whatsapp-db/         # Drizzle schema (independent, re-exported to @repo/database)
├── whatsapp-providers/  # Cloud API + Baileys implementations
services/
├── whatsapp-bridge/     # Baileys HTTP service (Docker)
├── whatsapp-worker/     # Outbox worker for queued messages
```

### Key Design Decisions
- **Same DATABASE_URL**: `@repo/whatsapp-db` is a schema package, not a separate DB.
- **Baileys in Docker**: Runs in separate service, not Next.js.
- **Multi-tenancy**: All WA tables include `organizationId`.
- **Idempotency**: `wa_events` unique `(accountId, providerEventId)`.
- **Extractability**: WhatsApp packages (`whatsapp-*`, `whatsapp-worker`, `whatsapp-bridge`) do not import studio packages.

---

## Completed (Phase 1A + 1B)

### Data Model (Drizzle)
- [x] `wa_accounts` - WhatsApp accounts (provider: `cloud_api` or `baileys`)
- [x] `wa_contacts` - Contacts
- [x] `wa_conversations` - Threads (includes `lastMessageId`, `lastMessageAt`, `unreadCount`)
- [x] `wa_messages` - Messages (text/media/template/status fields)
- [x] `wa_media` - Media records (provider id + storage url)
- [x] `wa_outbox` - Delivery queue with retry state
- [x] `wa_events` - Webhook ingestion log (idempotency)
- [x] `wa_campaigns` - Bulk campaign foundation
- [x] `wa_bot_flows` - Bot flow foundation

### Cloud API Provider Capabilities
- [x] `sendText()`
- [x] `sendMedia()`
- [x] `sendTemplate()`
- [x] `markRead()`

### Webhook Ingestion
- [x] GET `/api/webhooks/whatsapp/:token` - Meta verification
- [x] POST `/api/webhooks/whatsapp/:token` - Event ingestion
- [x] Stores events in `wa_events` with dedupe
- [x] Creates/updates:
  - Contacts (`wa_contacts`)
  - Conversations (`wa_conversations`)
  - Messages (`wa_messages`)
- [x] Status updates (sent/delivered/read/failed) map onto `wa_messages`

### Sending Pipeline
**Pattern**: API enqueues → worker sends → webhook updates delivery

- [x] Enqueue procedures:
  - [x] `connect-baileys` (creates account `qr_pending`)
  - [x] `connect-cloud-api` (creates account `connected`)
  - [x] `send-text` (atomic idempotency claim + contact/conversation + message + outbox)
  - [x] `send-media` (same atomic path, including `wa_media`)
  - [x] `send-template` (same atomic path after template validation)

- [x] Worker delivery:
  - [x] Polls `wa_outbox` (`pending`/`failed` with retry schedule)
  - [x] Sends `text` via Cloud API
  - [x] Sends `template` via Cloud API (reads from `wa_messages.templateName/templateParams`)
  - [x] Sends media via Cloud API (reads `wa_messages.mediaId -> wa_media.storageUrl`)
  - [x] Updates `wa_messages.providerMessageId` on success
  - [x] Updates `wa_messages.status` and outbox status

### Inbox APIs (Read + Minimal Mutations)
- [x] List conversations (cursor pagination + filters)
- [x] Get conversation (includes contact)
- [x] List messages in conversation (cursor pagination)
- [x] List contacts (cursor pagination + search)
- [x] Mark conversation read (sets `wa_conversations.unreadCount = 0`)

---

## Remaining Work (Detailed)

## P1 Reliability Merge Gates

The remediation keeps the existing Phase 1A/1B API surface and selectively ports the useful dev-branch campaign and automation behavior without importing Trigger.dev or unrelated UI changes.

- [x] Existing webhook rows retry while `processedAt` is null; processing and business writes share one transaction.
- [x] Contact identity is unique by account and WhatsApp ID.
- [x] Conversation and inbound-message creation are conflict-safe.
- [x] Outbox and inbound-media claims use expiring owner leases and recover stale pre-dispatch work.
- [x] Provider-dispatched work with an unknown local outcome enters `delivery_unknown` and is excluded from automatic retry.
- [x] Campaign recipients have a durable unique campaign/account/contact ledger and a frozen audience snapshot.
- [x] Campaign counts derive from committed recipient timestamps and terminal states rather than enqueue attempts.
- [x] Delivery webhook states are monotonic and idempotent, including resolution of `delivery_unknown`.
- [x] Opt-out, block, deleted-account, and connection state are rechecked immediately before provider dispatch.
- [x] Automation runs/actions are durable, duplicate triggers are unique, expired leases recover, and wait actions resume.
- [x] Manual text/template/media sends require a client idempotency key and commit one durable message/outbox effect atomically.

Migration `0040_whatsapp_delivery_reliability.sql` refuses to add identity constraints when duplicate contact or provider-message identities exist. Existing failed webhook rows become retryable. Legacy outbox rows already in `processing` are conservatively made terminal for manual reconciliation because the old schema cannot prove whether provider dispatch happened.

Post-review migrations `0049` and `0050` add explicit webhook event leases/retry clocks and booking sequence support. The API and worker now share the same webhook event processor. Provider redelivery improves latency but is no longer required for recovery.

All campaign actions now use the recipient ledger. `send` persists a campaign due immediately; `schedule` persists a future due time. The removed legacy campaign engine no longer creates messages or counters directly.

The earlier reliability lane remains in `0040`. The staged core-product remediation adds the manual-send claim table in generated migration `0052_whatsapp_manual_send_idempotency` and immutable outbox dispatch tokens in `0053_whatsapp_late_provider_acceptance`; Package 6 will reconstruct the unapplied development tail from `main` before shared rollout.

### Manual-send acceptance contract

- `send-text`, `send-template`, and `send-media` require an opaque 16–128 character `idempotencyKey`.
- A retry must keep the same key while its semantic payload is unchanged. Editing the account, destination, contact, message, template, or media payload requires a new key.
- Same organization + actor + account + key replays the original message/outbox IDs. Reusing that scoped key for a changed payload returns a conflict.
- Trigger.dev only wakes the worker after the database commit. Wake-up failure is logged and still returns `Message queued`; the database poller remains the delivery owner.
- No first-party web caller currently invokes these procedures. Any external caller must add stable-key retry behavior before the required-key API is rolled out.

### Campaign truth contract

- The first execution locks the campaign, captures the eligible contact IDs once, and records `audienceCapturedAt`. Retries never add contacts who became eligible later.
- `(campaignId, accountId, contactId)` is unique. Each recipient has at most one message, and each message has at most one outbox effect.
- Queued/sent/delivered/read totals are cumulative reached-state counts from recipient timestamps. Failed, suppressed, and delivery-unknown totals reflect the recipient's current terminal/uncertain state.
- A retry may re-enter campaign processing, but per-recipient row locking makes already committed effects no-ops.

### Delivery admission boundary

The worker rechecks current account/contact state after claiming and again in a row-locking transaction immediately before it records `dispatchStartedAt`. Ineligible work becomes `suppressed`, has no retry clock, updates campaign truth, and never calls the provider.

The database transaction cannot remain open across the external Meta request. A block, opt-out, disconnect, or delete committed after the final admission transaction can therefore race with the provider call. That boundary is explicit: once `dispatchStartedAt` is committed, an uncertain outcome is quarantined as `delivery_unknown` and is never blindly resent; provider callbacks or manual reconciliation resolve it.

Each provider attempt now records a random immutable `dispatchToken` with `dispatchStartedAt`. Normal success still requires the processing owner; success arriving after lease recovery may resolve the same `delivery_unknown` row only when that token matches. The provider identity is attached once, stored status webhooks are reconciled atomically, and conflicting identities remain quarantined with explicit manual-reconciliation evidence.

### Automation execution contract

- `(flowId, triggerIdentity)` uniquely identifies a run; the inbound webhook creates the run and immutable action snapshot in the same transaction as the inbound message.
- Each action has persisted status, attempts, retry time, owner lease, error, and deterministic run/index identity.
- Send actions use a unique `automationActionId` on the message plus a unique message outbox effect, so crash recovery cannot enqueue the non-idempotent effect twice.
- Wait deadlines are persisted once. Due waits advance the run; expired processing leases return to pending work.

Worker contract comparison and the decision not to adopt a queue library in this slice are recorded in [worker-state-contract-inventory.md](./worker-state-contract-inventory.md).

## Phase 1C (Next)

### 1) Template Sync (Meta)
Goal: avoid “guessing” template names/params; allow UI to pick from known templates.
- [ ] Create `wa_templates` table (or equivalent) to store:
  - `organizationId`, `accountId`, `name`, `language`, `status`, `category`, `components` (json)
  - timestamps + optional versioning
- [ ] Add sync job (service or API-triggered):
  - Fetch templates from Meta (Cloud API endpoint)
  - Upsert into DB
- [ ] Add API:
  - [ ] list templates (filter by status/category/language)
  - [ ] get template details

### 2) Media Upload Flow (first-class)
Current implementation assumes `mediaUrl` is already a public URL.
- [ ] Decide storage strategy:
  - S3 pre-signed upload (recommended)
  - Provider upload (`/media`) + store providerMediaId
- [ ] Add upload endpoint(s):
  - [ ] request upload (returns signed url + object key)
  - [ ] finalize upload (writes `wa_media` row)
- [ ] Update `send-media` to support either:
  - `mediaUrl` (public link) OR
  - `mediaId` (stored object) OR
  - `providerMediaId`

### 3) Message Read Receipts (provider-side)
- [ ] When `markConversationRead` is called:
  - Find latest inbound message(s) with `providerMessageId`
  - Call provider `markRead([providerMessageId])`
  - Persist read state

### 4) Operational Hardening
- [ ] Add rate limiting/backoff tuned to Cloud API limits
- [ ] Add dead-letter strategy for permanently failing outbox items
- [ ] Add observability: structured logs/metrics for worker send outcomes

## Phase 2

### Baileys Bridge (QR + Session)
- [ ] QR code generation and display
- [ ] Session persistence (Redis or DB)
- [ ] Auto-reconnect
- [ ] HTTP API contract between `packages/api` and `services/whatsapp-bridge`

### Real-time Updates
- [ ] WebSocket events:
  - message created
  - message status updated
  - conversation updated

### Contact Management
- [ ] Contact CRUD APIs
- [ ] Tags + segmentation
- [ ] External source linking

## Phase 3

### Bulk Campaigns
- [ ] Campaign CRUD APIs
- [ ] Audience selection
- [ ] Scheduling
- [ ] Rate limiting
- [ ] Analytics

### Bot Flows
- [ ] Flow model + trigger engine
- [ ] Branching logic
- [ ] Variable substitution

### Analytics
- [ ] Message volume metrics
- [ ] Delivery/read rates
- [ ] Agent response time (later, once agent model exists)

---

## Dev Commands
```bash
# Exclude WA packages from dev (they have no UI)
pnpm dev

# Type-check WhatsApp packages
pnpm --filter @repo/whatsapp-db type-check
pnpm --filter @repo/whatsapp-core type-check
pnpm --filter @repo/whatsapp-providers type-check
pnpm --filter @repo/whatsapp-worker type-check
pnpm --filter @repo/api type-check

# Apply migrations
pnpm --filter @repo/database db:generate
pnpm --filter @repo/database db:migrate

# Run outbox worker
pnpm --filter @repo/whatsapp-worker dev
```

## Key Files Reference
| Purpose | Path |
|---------|------|
| WhatsApp Router | `packages/api/modules/whatsapp/router.ts` |
| WhatsApp Schemas | `packages/api/modules/whatsapp/types.ts` |
| Webhook Handler | `packages/api/modules/whatsapp/webhook-handler.ts` |
| Send Text | `packages/api/modules/whatsapp/procedures/send-text.ts` |
| Send Media | `packages/api/modules/whatsapp/procedures/send-media.ts` |
| Send Template | `packages/api/modules/whatsapp/procedures/send-template.ts` |
| Inbox: Conversations | `packages/api/modules/whatsapp/procedures/list-conversations.ts` |
| Inbox: Messages | `packages/api/modules/whatsapp/procedures/list-messages.ts` |
| Inbox: Contacts | `packages/api/modules/whatsapp/procedures/list-contacts.ts` |
| Inbox: Get Conversation | `packages/api/modules/whatsapp/procedures/get-conversation.ts` |
| Inbox: Mark Read | `packages/api/modules/whatsapp/procedures/mark-conversation-read.ts` |
| Outbox Worker | `services/whatsapp-worker/src/index.ts` |
| Cloud API Provider | `packages/whatsapp-providers/src/cloud-api/provider.ts` |
| WA Schema | `packages/whatsapp-db/drizzle/schema/*.ts` |
| Feature Map | `docs/whatsapp-feature-map.md` |
