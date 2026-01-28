# SMS Integration - Learnings

## Task 1: SMS Outbox Database Schema

### Key Patterns Discovered

1. **Schema Structure Pattern**
   - SMS outbox mirrors WhatsApp outbox exactly for consistency with worker expectations
   - Uses UUID v7 for primary keys (via `$defaultFn(() => uuidv7())`)
   - Uses `text()` for phone numbers (E.164 format)
   - Uses `jsonb()` for template variables
   - Includes retry logic: `attempts`, `maxAttempts`, `nextAttemptAt`

2. **Status Enum Pattern**
   - SMS status enum: `pending`, `processing`, `sent`, `failed`
   - Matches WhatsApp outbox status enum exactly
   - Defined as `pgEnum` in schema file, exported from index.ts
   - Used as `.default("pending")` on status field

3. **Indexing Strategy**
   - Organization ID index for org-scoped queries
   - Status index for filtering by status
   - Next attempt index for retry queue processing
   - Composite queue index: `(status, nextAttemptAt)` for efficient worker queries

4. **Timestamps**
   - `createdAt` and `updatedAt` both use `timestamp(..., { withTimezone: true })`
   - Both have `.defaultNow()` for automatic defaults
   - `createdAt` is `.notNull()`, `updatedAt` is `.notNull()`

5. **Export Pattern**
   - Schema file exports both table and enum
   - Index.ts re-exports with comment describing what's exported
   - Follows existing pattern: `export * from "./sms"`

### Migration Generation

- Command: `cd packages/database && pnpm db:generate`
- Generated migration: `0018_fat_power_man.sql`
- Creates enum type and table with all indexes
- No foreign keys needed (organizationId is text, not FK)

### Build Verification

- TypeScript compilation: `pnpm type-check` ✓ (no errors)
- Schema exports verified in index.ts ✓
- Migration file created successfully ✓

### Files Created/Modified

1. **Created**: `packages/database/drizzle/schema/sms.ts` (56 lines)
   - Exports: `smsStatusEnum`, `smsOutbox`

2. **Modified**: `packages/database/drizzle/schema/index.ts`
   - Added SMS export line
   - Maintains alphabetical ordering

3. **Generated**: `packages/database/drizzle/migrations/0018_fat_power_man.sql`
   - Creates `sms_status` enum type
   - Creates `sms_outbox` table with 13 columns
   - Creates 4 indexes

### Next Task Dependencies

- Task 4 (SMS worker) depends on this schema
- Task 2 (package scaffolding) runs in parallel
- Schema is ready for worker implementation

## Conventions & Patterns

(Subagents will append findings here)

## Task 2: SMS Package Scaffolding

### Structure Created
- `packages/sms/` - Main package directory
- `packages/sms/package.json` - Dependencies: @repo/config, @repo/logs
- `packages/sms/tsconfig.json` - Uses @repo/tsconfig/base.json (not react-library)
- `packages/sms/index.ts` - Main exports (sendSMS, setProvider, getProvider, types)
- `packages/sms/src/types.ts` - SmsProvider interface, SmsTemplate with flowId/dltTemplateId
- `packages/sms/src/provider/index.ts` - Provider registry (setProvider, getProvider, send)
- `packages/sms/src/templates/index.ts` - Template registry stub (empty, for Task 5)
- `packages/sms/src/util/send.ts` - sendSMS wrapper with error handling

### Key Decisions
1. **tsconfig extends**: Used `@repo/tsconfig/base.json` (not react-library) since SMS is not React-dependent
2. **Provider pattern**: Mirrored mail package - registry with setProvider/getProvider functions
3. **Template types**: Includes MSG91-specific fields (flowId, dltTemplateId) as per requirements
4. **Dependencies**: Minimal - only @repo/config and @repo/logs (no SDK dependencies yet)

### Verification Results
- ✅ pnpm install succeeds (workspace resolves)
- ✅ pnpm type-check passes (no TypeScript errors)
- ✅ All required files created
- ✅ SmsProvider interface defined with send() method
- ✅ SmsTemplate includes flowId and dltTemplateId fields

### Next Steps
- Task 3: Implement MSG91 provider
- Task 5: Create actual SMS templates

## Task 3: MSG91 Provider Implementation

### Implementation Details

1. **Provider Structure**
   - `Msg91Provider` class implements `SmsProvider` interface
   - Config interface: `Msg91Config { authKey, senderId, route? }`
   - Uses `Required<Msg91Config>` internally to enforce defaults
   - Factory function `createMsg91Provider()` reads from env vars

2. **MSG91 Flow API Integration**
   - Endpoint: `https://api.msg91.com/api/v5/flow/`
   - Auth header: `authkey` (lowercase, not Authorization bearer)
   - Body: `{ flow_id, sender, mobiles, VAR1, ... }`
   - Response: `{ type: "success"|"error", message, request_id? }`

3. **Phone Normalization Logic**
   - Strip spaces, hyphens, parentheses
   - Remove leading + if present
   - Add 91 prefix if 10-digit local number
   - Validate final format: `91` + 10 digits
   - Logs warning for invalid formats but doesn't block

4. **Error Handling Pattern**
   - Returns `SmsSendResult { success: false, error: string }` on failure
   - Maps MSG91 `type: "error"` responses to readable errors
   - Catches network/JSON parse exceptions
   - Uses logger for structured error logging

5. **Environment Variables**
   - `MSG91_AUTH_KEY` - API authentication key
   - `MSG91_SENDER_ID` - 6-char sender ID (DLT registered)
   - Added to `.env.example` in SMS section

### Files Created/Modified

1. **Created**: `packages/sms/src/provider/msg91.ts` (152 lines)
   - Exports: `Msg91Provider`, `createMsg91Provider`, `Msg91Config`

2. **Modified**: `packages/sms/src/provider/index.ts`
   - Added MSG91 exports

3. **Modified**: `.env.example`
   - Added SMS section with MSG91 variables

### Key Decisions

1. **templateId required**: MSG91 Flow API requires a flow_id, so send() fails early without it
2. **VAR1 for message**: Simple templates use VAR1 for message content
3. **route defaults to 4**: Transactional route (1=Promotional, 4=Transactional)
4. **No + prefix**: MSG91 expects `919876543210` not `+919876543210`

### Next Task Dependencies

- Task 4 (SMS worker) can now use Msg91Provider
- Worker will call `createMsg91Provider()` on startup

## Task 4: SMS Worker Service

### Implementation Details

1. **Worker Structure** (mirroring WhatsApp worker)
   - Polling interval: 5000ms (configurable via `SMS_OUTBOX_INTERVAL_MS`)
   - Batch size: 10 (configurable via `SMS_OUTBOX_BATCH_SIZE`)
   - Status flow: pending → processing → sent/failed
   - Graceful shutdown: Listens for SIGTERM/SIGINT

2. **Retry Logic**
   - Exponential backoff: `Math.min(30 * attempts, 15 * 60)` seconds
   - Max 3 attempts (configurable via `maxAttempts` field)
   - On failure with retries remaining: status = "pending", nextAttemptAt = computed
   - On final failure: status = "failed", nextAttemptAt = null

3. **Query Pattern**
   - WHERE status = 'pending' AND (nextAttemptAt IS NULL OR nextAttemptAt <= NOW())
   - Uses drizzle operators: eq, and, or, isNull, lte

4. **Provider Integration**
   - Uses `createMsg91Provider()` from `@repo/sms/src/provider/msg91`
   - Extracts message from variables.message or variables.VAR1
   - Passes templateId from outbox record

5. **Package Structure**
   - `services/sms-worker/package.json` - Dependencies: @repo/database, @repo/logs, @repo/sms
   - `services/sms-worker/tsconfig.json` - Extends @repo/tsconfig/base.json with outDir/rootDir
   - `services/sms-worker/src/index.ts` - Main worker with polling loop

### Key Decisions

1. **Direct import from provider**: Used `@repo/sms/src/provider/msg91` instead of main index export
2. **tsx watch for dev**: Added `tsx watch` for hot-reload during development
3. **Added typescript**: Included `typescript` in devDeps for build script
4. **Simpler than WhatsApp**: No joins needed - smsOutbox has all fields directly

### Verification Results

- ✅ `pnpm type-check` passes
- ✅ `pnpm build` generates dist/index.js
- ✅ Worker starts (fails on missing DATABASE_URL which is expected)
- ✅ Import paths resolved correctly

### Environment Variables

- `DATABASE_URL` - Required for database connection
- `MSG91_AUTH_KEY` - MSG91 API authentication
- `MSG91_SENDER_ID` - MSG91 sender ID (6-char DLT registered)
- `SMS_OUTBOX_INTERVAL_MS` - Polling interval (default: 5000)
- `SMS_OUTBOX_BATCH_SIZE` - Batch size (default: 10)

## Task 5: Initial SMS Templates & Queue Utility

### Implementation Details

1. **Template Structure**
   - Created 4 SMS templates in `packages/sms/src/templates/index.ts`
   - Each template follows SmsTemplate interface: `{ id, flowId, dltTemplateId, name, variables }`
   - Templates use placeholder Flow IDs (FLOW_XXXXX) and DLT IDs (DLT_XXXXX)
   - Added TODO comment: "Update flowId and dltTemplateId after MSG91 registration"

2. **Template Definitions**
   - **booking-confirmation**: Confirm booking to client
     - Variables: clientName, bookingDate, shootType
   - **shoot-reminder**: Remind client of upcoming shoot
     - Variables: clientName, shootDate, location
   - **crew-assignment**: Notify crew of assignment
     - Variables: crewName, shootDate, role, location
   - **payment-reminder**: Payment due reminder
     - Variables: clientName, amount, dueDate, invoiceNumber

3. **Template Registry Pattern**
   - Exported individual template constants (bookingConfirmation, shootReminder, etc.)
   - Created `smsTemplates` registry object mapping template IDs to template objects
   - Implemented `getTemplate(templateId)` function with error handling
   - Exported `TemplateId` type for type-safe template ID usage

4. **queueSms() Implementation**
   - Location: `packages/sms/src/util/send.ts`
   - Accepts: organizationId, phoneNumber, templateId, variables
   - Inserts into `sms_outbox` table with:
     - status: "pending"
     - attempts: 0
     - maxAttempts: 3
   - Uses drizzle ORM: `db.insert(smsOutbox).values(...)`
   - Error handling: Logs errors and re-throws for caller handling

5. **Package Dependencies**
   - Added `@repo/database` to SMS package dependencies
   - Required for accessing `db` client and `smsOutbox` table
   - Maintains workspace dependency resolution

6. **Exports from Main Index**
   - Exported `queueSms` from `src/util/send`
   - Exported template constants: bookingConfirmation, shootReminder, crewAssignment, paymentReminder
   - Exported `smsTemplates` registry and `TemplateId` type
   - Exported `getTemplate` function

### Key Decisions

1. **Placeholder Flow IDs**: Used FLOW_XXXXX format to indicate these need to be updated after MSG91 registration
2. **Template Variables as Objects**: Defined variables as Record<string, any> with descriptive keys
3. **Direct DB Insert**: queueSms() directly inserts into sms_outbox without validation (validation happens at send time)
4. **No Template Validation**: Template variables are not validated at queue time - validation deferred to send time

### Verification Results

- ✅ `pnpm type-check` passes in SMS package (no TypeScript errors)
- ✅ All 4 templates created with correct structure
- ✅ queueSms() function implemented and exported
- ✅ Template registry pattern matches mail package conventions
- ✅ Dependencies resolved correctly

### Files Created/Modified

1. **Modified**: `packages/sms/src/templates/index.ts`
   - Replaced stub with 4 template definitions
   - Added template registry and getTemplate function

2. **Modified**: `packages/sms/src/util/send.ts`
   - Added queueSms() function
   - Imports: db, smsOutbox from @repo/database

3. **Modified**: `packages/sms/index.ts`
   - Added exports for queueSms
   - Added exports for all template constants and registry

4. **Modified**: `packages/sms/package.json`
   - Added @repo/database to dependencies

### Next Task Dependencies

- Task 5 is the final task - completes SMS integration
- SMS worker (Task 4) can now use queueSms() to queue messages
- Templates are ready for use in application code

### Pattern Notes

- Template pattern mirrors mail package structure
- Registry pattern allows type-safe template lookups
- Placeholder IDs follow convention: FLOW_TEMPLATE_NAME, DLT_TEMPLATE_NAME
- queueSms() follows async/await pattern with error logging
