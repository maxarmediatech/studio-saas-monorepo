# WhatsApp Feature Map

## Intro
The goal of the WhatsApp module within the Studio SaaS platform is to build full feature parity with both Whatomate and Whatsdesk, ensuring a robust, enterprise-grade messaging solution. Once maturity is reached, the WhatsApp core will be extracted as a standalone SaaS product.

## Whatomate Features
- **Multi-tenant Architecture**: Isolated data and configurations for multiple organizations.
- **Role-Based Access Control**: Granular permissions for Admin, Manager, and Agent roles.
- **WhatsApp Cloud API Integration**: Direct connection with Meta's official API.
- **Real-time Chat**: Live messaging with WebSocket support for instant updates.
- **Template Management**: Creation and synchronization of Meta-approved message templates.
- **Bulk Campaigns**: Sending mass messages with retry logic for failed deliveries.
- **Chatbot Automation**: Keyword-based replies, visual Flow Builder, and AI-powered responses (OpenAI, Anthropic, Google).
- **Canned Responses**: Quick replies with slash commands and dynamic placeholders.
- **Analytics Dashboard**: Performance tracking for messages, engagement, and campaigns.
- **WhatsApp Flows**: Visual builder for designing complex interactive flows.

## Whatsdesk Features
- **WhatsApp Cloud API Integration**: Official Meta API support.
- **Message Sending**: Support for Text, Media, and Template messages.
- **WhatsApp Calls**: Handling and notification of WhatsApp voice/video calls.
- **Contact Management**: Centralized management of WhatsApp contacts.
- **Basic Campaign Management**: Simplified bulk messaging tools.
- **Webhook Handling**: Reliable processing of inbound events.
- **Multi-user Support**: Simultaneous access for multiple team members.
- **Analytics**: Core messaging metrics and reporting.
- **API**: External REST API for integration.

## Merged Feature Set
- **Core Connectivity**:
    - Dual Provider Support: Official WhatsApp Cloud API and Baileys (WhatsApp Web API).
    - Robust Webhook Handling & Dispatching system.
    - External REST API for third-party integrations.
- **Messaging & Communication**:
    - Real-time Unified Inbox (WebSocket-powered).
    - Full Media Support (Text, Image, Video, Audio, Document, Sticker).
    - Canned Responses with slash commands and placeholders.
    - WhatsApp Call handling and notifications.
- **Automation & Intelligence**:
    - Advanced Chatbot with branching logic.
    - Visual Flow Builder for interactive customer journeys.
    - AI-powered conversations via LLM integrations.
- **Marketing & Growth**:
    - Bulk Campaigns with intelligent retry and rate-limiting.
    - Contact Management with segmentation and group support.
- **Enterprise Management**:
    - Multi-tenant isolation at the database level.
    - Advanced RBAC (Admin, Manager, Agent, Staff).
    - Meta-synced Template Management.
    - Comprehensive Analytics Dashboard.

## Status Tracker
| Feature | Status |
| --- | --- |
| Cloud API Provider (sendText, sendMedia, sendTemplate, markRead) | Done |
| Webhook Handling & Dispatching (verify + event ingestion) | Done |
| Outbox Worker / Message Delivery | Done |
| Database Schema (accounts, contacts, conversations, messages, events, outbox, campaigns, bot-flows) | Done |
| API Procedures (connect-baileys, connect-cloud-api, send-text) | Done |
| Multi-tenant Isolation (organizationId on all tables) | Done |
| Idempotency via wa_events table | Done |
| Baileys Provider (QR + session management) | Planned |
| Real-time Unified Inbox | Planned |
| Templates + Media Send (API layer) | Planned |
| Inbound Inbox APIs (list conversations/messages) | Planned |
| Full Media Support | Planned |
| Canned Responses | Planned |
| WhatsApp Call handling & notifications | Planned |
| Advanced Chatbot | Planned |
| Visual Flow Builder | Planned |
| AI-powered Conversations | Planned |
| Bulk Campaigns | Planned |
| Contact Management & Segmentation | Planned |
| RBAC (Admin/Manager/Agent/Staff) | Planned |
| Template Management (Meta sync) | Planned |
| Analytics Dashboard | Planned |

## Phase 1 Priorities
The "most important" priorities focused on establishing a production-ready foundation:
- [x] **Core Connectivity**: Cloud API provider implemented (Baileys planned).
- [x] **Webhook Reliability**: Durable webhook processing with idempotency via wa_events table.
- [x] **SaaS Foundation**: Strict organization isolation with organizationId on all tables.
- [x] **Outbox Worker**: Queued message delivery with retry logic.
- [ ] **Real-time Inbox**: Two-way messaging (Text & Media) with WebSocket synchronization.
- [ ] **Template Management**: Full support for syncing and sending Meta-approved templates.
- [ ] **Contact Sync**: Basic contact management and synchronization with WhatsApp IDs.
- [ ] **Basic Analytics**: Tracking of delivery status (Sent, Delivered, Read) and basic volume metrics.

## Next Implementation Chunks
1. **Templates + Media Send** - Add sendTemplate and sendMedia to API layer
2. **Inbound Inbox APIs** - List conversations, messages, contacts
3. **Baileys Bridge** - QR code flow, session persistence, reconnection
4. **Real-time Updates** - WebSocket events for new messages and status changes
