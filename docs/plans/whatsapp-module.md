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
  - [x] `send-text` (insert `wa_messages` + `wa_outbox`)
  - [x] `send-media` (insert `wa_media` + `wa_messages` + `wa_outbox`)
  - [x] `send-template` (insert `wa_messages` + `wa_outbox`)

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

## Phase 1C (Next)

### 1) Template Sync (Meta)
Goal: avoid “guessing” template names/params; allow UI to pick from known templates.
- [x] Create `wa_templates` table (or equivalent) to store:
  - `organizationId`, `accountId`, `name`, `language`, `status`, `category`, `components` (json)
  - timestamps + optional versioning
- [x] Add sync job (service or API-triggered):
  - Fetch templates from Meta (Cloud API endpoint)
  - Upsert into DB
- [ ] Add API:
  - [x] list templates (filter by status/category/language)
  - [ ] get template details
- [x] Inbox template picker for approved synced templates
- [x] `send-template` validates against synced account templates instead of name-only guessing

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
