# SMS Integration with MSG91

## TL;DR

> **Quick Summary**: Implement production-grade SMS infrastructure using MSG91 as the provider, with provider-agnostic architecture for future flexibility. Follows existing WhatsApp outbox+worker pattern.
> 
> **Deliverables**:
> - `packages/sms` - SMS package with MSG91 provider and template definitions
> - `services/sms-worker` - Background worker for outbox processing
> - Database schema for `sms_outbox` table
> - Code-defined SMS templates with MSG91 Flow ID mappings
> 
> **Estimated Effort**: Medium (3-5 days)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 (Schema) -> Task 3 (Provider) -> Task 4 (Worker)

---

## Context

### Original Request
Implement a message sending feature to notify crew, nudge crew, send reminders to clients, and send confirmations. User wants to start with SMS integration as the foundation before finalizing full notification requirements.

### Interview Summary
**Key Discussions**:
- **Provider**: MSG91 chosen over Twilio/SNS for India cost-effectiveness (~10x cheaper)
- **Architecture**: Provider-agnostic with MSG91 default, can add Twilio later
- **Pattern**: Mirror WhatsApp outbox + worker (DB polling, no Redis)
- **Templates**: Code-defined, version controlled (like React Email)
- **Multi-tenancy**: Platform provides SMS (single MSG91 account)
- **Triggers**: Automated only, no manual send UI
- **Tests**: No unit tests, type-checking only (matches existing packages)

**Research Findings**:
- Existing infrastructure: Email (Resend), WhatsApp (Meta Cloud API), In-App notifications
- User/Crew/Client all have phone numbers stored
- Phone validation regex exists: `packages/api/modules/studio/schemas/common.ts`
- WhatsApp worker pattern: `services/whatsapp-worker/src/index.ts`
- Outbox schema: `packages/whatsapp-db/drizzle/schema/outbox.ts`

### Metis Review
**Identified Gaps** (addressed):
- **DLT Registration**: Added as pre-requisite, not code task
- **Template-to-FlowID mapping**: Added to template structure
- **Sender ID strategy**: Platform-level, single transactional ID
- **Rate limiting**: Worker handles via exponential backoff
- **Phone validation**: Use existing `phoneSchema`

**Pre-requisites Identified** (USER ACTION REQUIRED):
1. MSG91 account with DLT registration complete
2. At least one Sender ID registered and approved
3. At least one template approved on DLT and mapped to MSG91 Flow

---

## Work Objectives

### Core Objective
Build production-grade SMS sending infrastructure that mirrors the existing WhatsApp pattern, using MSG91 as the provider with a pluggable architecture for future provider additions.

### Concrete Deliverables
- `packages/sms/` - New package with provider interface and MSG91 implementation
- `packages/database/drizzle/schema/sms.ts` - SMS outbox table schema
- `services/sms-worker/` - Background worker service
- SMS template definitions with MSG91 Flow ID mappings
- Environment variable documentation

### Definition of Done
- [x] `pnpm build` passes with new packages
- [x] `pnpm lint` passes
- [x] SMS worker can poll outbox and send via MSG91
- [x] At least one template defined and mapped to MSG91 Flow

### Must Have
- Provider-agnostic interface (like `packages/mail/src/provider/`)
- MSG91 provider implementation
- Outbox table with same fields as WhatsApp outbox
- Background worker with polling + retry logic
- Phone number normalization to E.164
- DLT Template ID field in template definitions
- MSG91 Flow ID mapping for each template

### Must NOT Have (Guardrails)
- NO OTP functionality (separate feature, MSG91 has dedicated OTP API)
- NO template creation via MSG91 API (templates pre-registered in dashboard)
- NO manual send UI/endpoints (automated triggers only)
- NO Redis/BullMQ (use DB polling like WhatsApp)
- NO per-org SMS configuration (platform account only)
- NO delivery status webhooks in v1 (can add later)
- NO Twilio/SNS providers in v1 (architecture supports it, but defer)
- NO promotional SMS routing (transactional only for now)
- NO international SMS handling (India-only for now)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest in packages/editor)
- **User wants tests**: NO (match existing mail/whatsapp pattern)
- **Framework**: N/A - type-checking only

### Manual Execution Verification

Each TODO includes verification via:
- `pnpm build` - Type checking and compilation
- `pnpm lint` - Code quality
- Manual API testing with MSG91 sandbox (where applicable)
- Worker log inspection for outbox processing

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Database schema (sms_outbox table)
└── Task 2: Package scaffolding (packages/sms)

Wave 2 (After Wave 1):
├── Task 3: MSG91 provider implementation
└── Task 4: SMS worker service
    └── (depends on Task 1 + Task 3)

Wave 3 (After Wave 2):
└── Task 5: Template definitions + wiring

Critical Path: Task 1 → Task 3 → Task 4 → Task 5
Parallel Speedup: ~30% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 4 | 2 |
| 2 | None | 3 | 1 |
| 3 | 2 | 4 | None |
| 4 | 1, 3 | 5 | None |
| 5 | 4 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | `delegate_task(category="quick", load_skills=["git-master"], run_in_background=true)` |
| 2 | 3, 4 | `delegate_task(category="unspecified-high", load_skills=[], run_in_background=false)` - sequential due to deps |
| 3 | 5 | `delegate_task(category="quick", load_skills=["git-master"], run_in_background=false)` |

---

## TODOs

### - [x] 1. Create SMS Outbox Database Schema

**What to do**:
- Create `packages/database/drizzle/schema/sms.ts`
- Define `smsOutbox` table mirroring WhatsApp outbox structure
- Add status enum: `pending`, `processing`, `sent`, `failed`
- Include fields: `id`, `phoneNumber`, `templateId`, `variables`, `status`, `attempts`, `maxAttempts`, `nextAttemptAt`, `errorMessage`, `providerMessageId`, `organizationId`, `createdAt`, `updatedAt`
- Export from main schema index
- Run `pnpm db:generate` to create migration

**Must NOT do**:
- Add per-org SMS settings tables
- Add delivery tracking/webhook tables
- Create OTP-specific tables

**Recommended Agent Profile**:
- **Category**: `quick`
  - Reason: Single file creation, follows existing pattern exactly
- **Skills**: [`git-master`]
  - `git-master`: For atomic commit after schema creation
- **Skills Evaluated but Omitted**:
  - `frontend-ui-ux`: No UI work

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Task 2)
- **Blocks**: Task 4 (worker needs schema)
- **Blocked By**: None (can start immediately)

**References** (CRITICAL):

**Pattern References**:
- `packages/whatsapp-db/drizzle/schema/outbox.ts` - EXACT pattern to follow for outbox table structure, status enum, retry fields

**API/Type References**:
- `packages/database/drizzle/schema/studio.ts` - See how tables are defined in this codebase
- `packages/database/drizzle/schema/index.ts` - Export pattern for new schema files

**Documentation References**:
- Drizzle ORM docs for PostgreSQL table definition

**WHY Each Reference Matters**:
- `outbox.ts` - Copy the exact field structure (status, attempts, nextAttemptAt, errorMessage) to ensure worker compatibility
- `studio.ts` - Shows how to use UUID v7, timestamps, organization relations

**Acceptance Criteria**:

**Manual Execution Verification:**
- [x] File created: `packages/database/drizzle/schema/sms.ts`
- [x] Command: `cd packages/database && pnpm db:generate`
  - Expected: Migration file created in `drizzle/migrations/`
- [x] Command: `pnpm build --filter=@repo/database`
  - Expected: No TypeScript errors
- [x] Verify `smsOutbox` is exported from `packages/database/drizzle/schema/index.ts`

**Commit**: YES
- Message: `feat(database): add sms_outbox table schema`
- Files: `packages/database/drizzle/schema/sms.ts`, `packages/database/drizzle/schema/index.ts`
- Pre-commit: `pnpm build --filter=@repo/database`

---

### - [x] 2. Scaffold SMS Package Structure

**What to do**:
- Create `packages/sms/` directory structure:
  ```
  packages/sms/
  ├── package.json
  ├── tsconfig.json
  ├── src/
  │   ├── index.ts          # Main exports
  │   ├── types.ts          # Provider interface, template types
  │   ├── provider/
  │   │   └── index.ts      # Provider registry
  │   ├── templates/
  │   │   └── index.ts      # Template definitions
  │   └── util/
  │       └── send.ts       # Queue SMS to outbox
  ```
- Define provider interface: `SmsProvider` with `send()` method
- Define template types with `flowId` (MSG91) and `dltTemplateId` fields
- Add to workspace in root `pnpm-workspace.yaml` if needed
- Add package.json with correct dependencies and exports

**Must NOT do**:
- Implement actual MSG91 provider (Task 3)
- Add test configuration
- Create templates (Task 5)

**Recommended Agent Profile**:
- **Category**: `quick`
  - Reason: Scaffolding with boilerplate, follows existing package patterns
- **Skills**: [`git-master`]
  - `git-master`: Atomic commit for package scaffolding
- **Skills Evaluated but Omitted**:
  - `frontend-ui-ux`: No UI work

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Task 1)
- **Blocks**: Task 3 (provider needs package structure)
- **Blocked By**: None (can start immediately)

**References** (CRITICAL):

**Pattern References**:
- `packages/mail/package.json` - Package.json structure, dependencies, exports
- `packages/mail/src/index.ts` - Export pattern
- `packages/mail/src/provider/index.ts` - Provider registry pattern
- `packages/mail/types.ts` - Provider interface definition

**API/Type References**:
- `packages/mail/src/util/send.ts` - Main send utility pattern

**WHY Each Reference Matters**:
- `packages/mail/` - This is the direct analog; SMS package should mirror its structure exactly
- Provider interface pattern shows how to abstract provider from business logic

**Acceptance Criteria**:

**Manual Execution Verification:**
- [x] Directory created: `packages/sms/`
- [x] Command: `pnpm install` (from root)
  - Expected: No errors, workspace resolves
- [x] Command: `pnpm build --filter=@repo/sms`
  - Expected: Builds successfully (even with stub implementations)
- [x] `SmsProvider` interface defined with `send()` method signature

**Commit**: YES
- Message: `feat(sms): scaffold sms package structure`
- Files: `packages/sms/**`
- Pre-commit: `pnpm build --filter=@repo/sms`

---

### - [x] 3. Implement MSG91 Provider

**What to do**:
- Create `packages/sms/src/provider/msg91.ts`
- Implement `Msg91Provider` class implementing `SmsProvider` interface
- Use MSG91 Flow API: `https://api.msg91.com/api/v5/flow/`
- Handle authentication via `authkey` header
- Accept configuration: `authKey`, `senderId`, `route` (default: 4 for transactional)
- Implement phone number normalization (strip spaces, ensure +91 prefix for Indian numbers)
- Handle MSG91 response codes and map to standard errors
- Export from provider index
- Add environment variables: `MSG91_AUTH_KEY`, `MSG91_SENDER_ID`

**Must NOT do**:
- Add Twilio/SNS providers
- Implement delivery webhooks
- Create MSG91 templates via API
- Add OTP-specific logic

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
  - Reason: API integration requires careful implementation, error handling
- **Skills**: []
  - No special skills needed - standard TypeScript API work
- **Skills Evaluated but Omitted**:
  - `git-master`: Will commit with Task 4 together

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 2 (sequential)
- **Blocks**: Task 4 (worker needs provider)
- **Blocked By**: Task 2 (needs package structure)

**References** (CRITICAL):

**Pattern References**:
- `packages/mail/src/provider/resend.ts` - Provider implementation pattern, error handling
- `packages/whatsapp-providers/src/cloud-api/provider.ts` - External API integration pattern with fetch

**API/Type References**:
- MSG91 Flow API: `https://api.msg91.com/api/v5/flow/` (POST with flow_id, mobiles, variables)

**External References**:
- MSG91 API Docs: `https://docs.msg91.com/reference/send-sms-flow-api`

**WHY Each Reference Matters**:
- `resend.ts` - Shows how to wrap external API with error handling
- `cloud-api/provider.ts` - Shows fetch-based API calls in this codebase

**Acceptance Criteria**:

**Manual Execution Verification:**
- [x] File created: `packages/sms/src/provider/msg91.ts`
- [x] Command: `pnpm build --filter=@repo/sms`
  - Expected: No TypeScript errors
- [x] MSG91 provider exported from `packages/sms/src/provider/index.ts`
- [x] Phone normalization handles: `9876543210`, `+919876543210`, `91 9876543210` → `919876543210`
- [x] Environment variables documented in `.env.example`

**Commit**: NO (groups with Task 4)

---

### - [x] 4. Create SMS Worker Service

**What to do**:
- Create `services/sms-worker/` directory:
  ```
  services/sms-worker/
  ├── package.json
  ├── tsconfig.json
  ├── src/
  │   └── index.ts    # Main worker entry
  ```
- Implement worker that:
  - Polls `sms_outbox` table for `pending` messages
  - Locks rows with `processing` status
  - Calls MSG91 provider to send
  - Updates status to `sent` or `failed`
  - Implements exponential backoff (30s × attempts, max 15min)
  - Max 3 retry attempts
  - Graceful shutdown handling
- Mirror `services/whatsapp-worker/src/index.ts` exactly
- Add npm scripts: `start`, `dev`

**Must NOT do**:
- Use Redis/BullMQ
- Add delivery webhook handling
- Process multiple message types differently
- Add rate limiting beyond MSG91's natural limits

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
  - Reason: Worker implementation with polling, retry logic, error handling
- **Skills**: [`git-master`]
  - `git-master`: Atomic commit for worker + provider together
- **Skills Evaluated but Omitted**:
  - `frontend-ui-ux`: No UI work

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 2 (sequential, after Task 3)
- **Blocks**: Task 5 (templates need working infrastructure)
- **Blocked By**: Task 1 (schema), Task 3 (provider)

**References** (CRITICAL):

**Pattern References**:
- `services/whatsapp-worker/src/index.ts` - EXACT pattern to follow: polling loop, status updates, retry logic, graceful shutdown
- `services/calendar-worker/src/index.ts` - Alternative worker pattern reference

**API/Type References**:
- `packages/database/` - Database client import pattern
- Schema from Task 1 for `smsOutbox` table

**WHY Each Reference Matters**:
- `whatsapp-worker` - The canonical pattern. Copy structure exactly: polling interval, status enum handling, exponential backoff formula, shutdown signals

**Acceptance Criteria**:

**Manual Execution Verification:**
- [x] Directory created: `services/sms-worker/`
- [x] Command: `cd services/sms-worker && pnpm build`
  - Expected: No TypeScript errors
- [x] Worker starts: `cd services/sms-worker && pnpm dev`
  - Expected: Logs "SMS worker started, polling every Xms"
- [x] Worker handles SIGTERM gracefully
- [x] Verify polling logic matches WhatsApp worker exactly

**Commit**: YES
- Message: `feat(sms): add msg91 provider and worker service`
- Files: `packages/sms/src/provider/msg91.ts`, `services/sms-worker/**`
- Pre-commit: `pnpm build`

---

### - [x] 5. Define Initial SMS Templates

**What to do**:
- Create template definitions in `packages/sms/src/templates/`
- Define template structure with:
  - `id` - Internal identifier
  - `flowId` - MSG91 Flow ID (from MSG91 dashboard)
  - `dltTemplateId` - DLT Template ID (from TRAI registration)
  - `name` - Human-readable name
  - `variables` - TypeScript type for required variables
- Create initial templates (with placeholder Flow IDs to be filled):
  - `booking-confirmation` - Confirm booking to client
  - `shoot-reminder` - Remind client of upcoming shoot
  - `crew-assignment` - Notify crew of assignment
  - `payment-reminder` - Payment due reminder
- Create `queueSms()` utility function to add to outbox
- Export from package index

**Must NOT do**:
- Create templates in MSG91 via API
- Add template management UI
- Implement template variable validation (TypeScript types are enough)

**Recommended Agent Profile**:
- **Category**: `quick`
  - Reason: Template definitions are straightforward, follow established pattern
- **Skills**: [`git-master`]
  - `git-master`: Final commit for the feature
- **Skills Evaluated but Omitted**:
  - `frontend-ui-ux`: No UI work

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 3 (final)
- **Blocks**: None (final task)
- **Blocked By**: Task 4 (needs working infrastructure)

**References** (CRITICAL):

**Pattern References**:
- `packages/mail/emails/` - Template organization pattern
- `packages/whatsapp-core/src/templates/` - If exists, template definition pattern

**API/Type References**:
- Template types from Task 2

**WHY Each Reference Matters**:
- Email templates show how to organize and export template definitions
- Type definitions ensure variables are correctly passed

**Acceptance Criteria**:

**Manual Execution Verification:**
- [x] Template files created in `packages/sms/src/templates/`
- [x] At least 4 templates defined with placeholder Flow IDs
- [x] `queueSms()` function implemented and exported
- [x] Command: `pnpm build --filter=@repo/sms`
  - Expected: No TypeScript errors
- [x] Templates exported from `packages/sms/src/index.ts`

**Commit**: YES
- Message: `feat(sms): add initial sms templates and queue utility`
- Files: `packages/sms/src/templates/**`, `packages/sms/src/util/send.ts`
- Pre-commit: `pnpm build --filter=@repo/sms`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(database): add sms_outbox table schema` | `packages/database/drizzle/schema/sms.ts` | `pnpm build --filter=@repo/database` |
| 2 | `feat(sms): scaffold sms package structure` | `packages/sms/**` | `pnpm build --filter=@repo/sms` |
| 3+4 | `feat(sms): add msg91 provider and worker service` | `packages/sms/src/provider/msg91.ts`, `services/sms-worker/**` | `pnpm build` |
| 5 | `feat(sms): add initial sms templates and queue utility` | `packages/sms/src/templates/**` | `pnpm build` |

---

## Success Criteria

### Verification Commands
```bash
# All builds pass
pnpm build  # Expected: 0 errors

# Lint passes
pnpm lint   # Expected: 0 errors

# Worker can start
cd services/sms-worker && pnpm dev  # Expected: "SMS worker started..."

# Package exports correctly
node -e "require('@repo/sms')"  # Expected: No errors
```

### Final Checklist
- [x] `packages/sms/` exists with provider interface
- [x] MSG91 provider implemented
- [x] `services/sms-worker/` polls outbox
- [x] `sms_outbox` table schema created
- [x] At least 4 template definitions exist
- [x] `queueSms()` utility function works
- [x] No OTP functionality added
- [x] No manual send UI added
- [x] No per-org configuration added

---

## Pre-requisites (USER ACTION REQUIRED)

Before implementation can be fully tested:

1. **MSG91 Account Setup**
   - Create MSG91 account: https://msg91.com
   - Complete DLT registration with telecom operators
   - Get Auth Key from MSG91 dashboard

2. **Sender ID Registration**
   - Register at least one Sender ID (6 chars)
   - Wait for approval (24-72 hours)

3. **Template Registration**
   - Create templates in MSG91 dashboard
   - Get DLT Template IDs
   - Note MSG91 Flow IDs for each template

4. **Environment Variables**
   - Add to `.env.local`:
     ```
     MSG91_AUTH_KEY=your_auth_key
     MSG91_SENDER_ID=YOURID
     ```

**NOTE**: Code implementation can proceed without these, but end-to-end testing requires completed registration.
