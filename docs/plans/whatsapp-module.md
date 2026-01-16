# WhatsApp Module Implementation Plan

## Overview
Building a WhatsApp automation module for Studio SaaS that can be extracted as a standalone SaaS later. All WhatsApp packages have zero studio imports to enable this extraction.

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
- **Same DATABASE_URL**: whatsapp-db is a schema package, not a separate database
- **Baileys in Docker**: Runs in separate service, not Next.js (avoids native module issues)
- **Multi-tenancy**: All tables have `organizationId`
- **Idempotency**: `wa_events` table with unique `providerEventId`
- **Extractability**: WhatsApp packages import nothing from studio packages

## Completed (Phase 1A)

### Database Schema
- [x] `wa_accounts` - WhatsApp accounts (Cloud API or Baileys)
- [x] `wa_contacts` - Contact records
- [x] `wa_conversations` - Chat threads
- [x] `wa_messages` - Message records
- [x] `wa_events` - Webhook event log (idempotency)
- [x] `wa_outbox` - Message queue for sending
- [x] `wa_campaigns` - Bulk messaging campaigns
- [x] `wa_bot_flows` - Chatbot automation flows
- [x] `wa_media` - Media file references

### Cloud API Provider
- [x] `sendText()` - Send text messages
- [x] `sendMedia()` - Send media messages
- [x] `sendTemplate()` - Send template messages
- [x] `markRead()` - Mark messages as read

### Webhook Handling
- [x] GET `/api/webhooks/whatsapp/:token` - Meta verification
- [x] POST `/api/webhooks/whatsapp/:token` - Event ingestion
- [x] Inbound message processing
- [x] Status update processing (sent, delivered, read, failed)

### Outbox Worker
- [x] Poll `wa_outbox` for pending messages
- [x] Send via Cloud API provider
- [x] Retry logic with exponential backoff
- [x] Status sync back to `wa_messages`

### API Procedures
- [x] `connect-baileys` - Create Baileys account (QR pending)
- [x] `connect-cloud-api` - Create Cloud API account
- [x] `send-text` - Queue text message for sending

## In Progress (Phase 1B)

### Templates + Media Send
- [ ] `sendTemplate` API procedure
- [ ] `sendMedia` API procedure
- [ ] Template sync from Meta Business Manager
- [ ] Media upload to storage

### Inbound Inbox APIs
- [ ] List conversations (with pagination, filters)
- [ ] List messages in conversation
- [ ] Get conversation details
- [ ] Mark conversation as read

## Planned (Phase 2)

### Baileys Bridge
- [ ] QR code generation and display
- [ ] Session persistence (Redis or DB)
- [ ] Auto-reconnection logic
- [ ] HTTP API for bridge communication

### Real-time Updates
- [ ] WebSocket server for live updates
- [ ] New message events
- [ ] Status change events
- [ ] Typing indicators

### Contact Management
- [ ] Contact CRUD APIs
- [ ] Contact import/export
- [ ] Tags and segmentation
- [ ] External source linking

## Planned (Phase 3)

### Bulk Campaigns
- [ ] Campaign CRUD APIs
- [ ] Audience selection
- [ ] Scheduling
- [ ] Rate limiting
- [ ] Analytics

### Bot Flows
- [ ] Flow builder data model
- [ ] Keyword triggers
- [ ] Conditional branching
- [ ] Variable substitution

### Analytics
- [ ] Message volume metrics
- [ ] Delivery rates
- [ ] Response times
- [ ] Campaign performance

## Dev Commands
```bash
# Exclude WA packages from dev (they have no UI)
pnpm dev

# Type-check WhatsApp packages
pnpm --filter @repo/whatsapp-db type-check
pnpm --filter @repo/whatsapp-core type-check
pnpm --filter @repo/whatsapp-providers type-check
pnpm --filter @repo/whatsapp-worker type-check

# Generate and apply migrations
pnpm --filter @repo/database db:generate
pnpm --filter @repo/database db:migrate

# Run outbox worker
pnpm --filter @repo/whatsapp-worker dev
```

## Key Files Reference
| Purpose | Path |
|---------|------|
| Cloud API Provider | `packages/whatsapp-providers/src/cloud-api/provider.ts` |
| Webhook Parser | `packages/whatsapp-core/src/domain/cloud-api.ts` |
| Webhook Handler | `packages/api/modules/whatsapp/webhook-handler.ts` |
| Outbox Worker | `services/whatsapp-worker/src/index.ts` |
| WA Schema | `packages/whatsapp-db/drizzle/schema/*.ts` |
| Feature Map | `docs/whatsapp-feature-map.md` |
| API Router | `packages/api/modules/whatsapp/router.ts` |
