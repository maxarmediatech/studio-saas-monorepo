# SMS Integration - Critical Fixes

## TL;DR

> **Quick Summary**: Fix 14 critical and high-priority issues identified by Oracle review to make SMS integration production-ready.
> 
> **Deliverables**:
> - Schema migration with lease fields and debug metadata
> - Worker with atomic claiming and graceful shutdown
> - Provider with timeout, strict validation, and better error handling
> - Tests for all critical paths
> 
> **Estimated Effort**: High (12-20 hours)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Schema → Worker → Provider

---

## Context

### Oracle Review Findings
The Oracle identified 14 issues across 3 components:
- **5 CRITICAL** issues (production blockers)
- **4 HIGH** severity issues (should fix)
- **5 MEDIUM** severity issues (nice to have)

**Current Status**: NOT production-ready. Will cause duplicates, hangs, and lost messages.

### Original Implementation
- Database schema: `packages/database/drizzle/schema/sms.ts`
- SMS worker: `services/sms-worker/src/index.ts`
- MSG91 provider: `packages/sms/src/provider/msg91.ts`

### Issues Summary
**Worker**: Race conditions, overlapping batches, stuck messages, non-graceful shutdown
**Provider**: No timeout, weak validation, poor error handling
**Schema**: Missing lease fields, incomplete debug metadata, suboptimal indexes

---

## Work Objectives

### Core Objective
Fix all critical and high-priority issues to make SMS integration production-ready with proper concurrency handling, error recovery, and operational visibility.

### Concrete Deliverables
- Schema migration adding lease and debug fields
- Worker with atomic claiming using `FOR UPDATE SKIP LOCKED`
- Worker with graceful shutdown and stuck message recovery
- Provider with request timeout and strict phone validation
- Provider with proper error classification (retryable vs fatal)
- Tests covering critical paths and edge cases

### Definition of Done
- [x] All 5 critical issues fixed
- [x] All 4 high-priority issues fixed
- [x] Tests pass for concurrency scenarios
- [x] Tests pass for failure scenarios
- [x] `pnpm build` passes
- [x] `pnpm lint` passes
- [x] Load testing shows no duplicates
- [x] Worker recovers from crashes

### Must Have
- Atomic message claiming (no duplicates)
- Request timeout (no hangs)
- Stuck message recovery (no lost messages)
- Strict phone validation (no invalid sends)
- Graceful shutdown (no data loss)
- Proper error classification (smart retries)

### Must NOT Have (Guardrails)
- NO breaking changes to public API
- NO changes to template structure
- NO changes to queueSms() signature
- NO removal of existing functionality

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest in packages/editor)
- **User wants tests**: YES (TDD required for fixes)
- **Framework**: Vitest for packages, integration tests for worker

### Test Coverage Required
- Unit tests for phone normalization
- Unit tests for error classification
- Integration tests for atomic claiming
- Integration tests for stuck message recovery
- Integration tests for graceful shutdown
- Load tests for concurrency

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Schema migration (lease + debug fields)
└── Task 2: Add tests for provider (phone validation, timeout)

Wave 2 (After Wave 1):
├── Task 3: Fix provider (timeout, validation, errors)
└── Task 4: Add tests for worker (atomic claim, shutdown)

Wave 3 (After Wave 2):
├── Task 5: Fix worker (atomic claim, graceful shutdown)
└── Task 6: Add integration tests

Wave 4 (After Wave 3):
└── Task 7: Fix medium-priority issues (backoff, indexes, PII)

Critical Path: Task 1 → Task 5 → Task 6
Parallel Speedup: ~40% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 5 | 2 |
| 2 | None | 3 | 1 |
| 3 | 2 | None | 4 |
| 4 | 1 | 5 | 3 |
| 5 | 1, 4 | 6 | None |
| 6 | 5 | None | None |
| 7 | 6 | None | None |

---

## TODOs

### - [x] 1. Schema Migration - Add Lease and Debug Fields

**What to do**:
- Create new migration file in `packages/database/drizzle/migrations/`
- Add lease fields: `lockedAt`, `lockedBy`, `processingStartedAt`
- Add debug fields: `lastAttemptAt`, `providerStatusCode`, `errorCode`, `isPermanentFailure`
- Update schema file: `packages/database/drizzle/schema/sms.ts`
- Add partial indexes for better queue performance
- Run `pnpm db:generate` to create migration
- Test migration up/down

**Must NOT do**:
- Do NOT change existing field types
- Do NOT remove any existing fields
- Do NOT break backward compatibility

**Recommended Agent Profile**:
- **Category**: `quick`
- **Skills**: [`commit`]

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Task 2)
- **Blocks**: Task 5 (worker needs lease fields)
- **Blocked By**: None

**References** (CRITICAL):
- `packages/database/drizzle/schema/sms.ts` - Current schema
- `.sisyphus/notepads/sms-integration/ORACLE_REVIEW_SUMMARY.md` - Required fields

**Acceptance Criteria**:
- [x] Migration file created
- [x] Lease fields added: `lockedAt`, `lockedBy`, `processingStartedAt`
- [x] Debug fields added: `lastAttemptAt`, `providerStatusCode`, `errorCode`, `isPermanentFailure`
- [x] Partial indexes created for queue queries
- [x] Migration tested (up and down)
- [x] Schema exports updated
- [x] `pnpm build --filter=@repo/database` passes

**Commit**: YES
- Message: `fix(database): add lease and debug fields to sms_outbox`

---

### - [x] 2. Add Tests for Provider (Phone Validation, Timeout)

**What to do**:
- Create `packages/sms/src/provider/msg91.test.ts`
- Write tests for phone normalization:
  - Valid formats: `9876543210`, `+919876543210`, `91 9876543210`, `0919876543210`, `00919876543210`
  - Invalid formats: empty, non-digits, non-Indian, too short, too long
- Write tests for timeout handling
- Write tests for error classification (429, 5xx, 4xx, network errors)
- Add vitest config if needed
- All tests should FAIL initially (TDD)

**Must NOT do**:
- Do NOT implement fixes yet (tests first!)
- Do NOT skip any edge cases
- Do NOT use mocks for phone normalization

**Recommended Agent Profile**:
- **Category**: `quick`
- **Skills**: [`test-driven-development`]

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Task 1)
- **Blocks**: Task 3 (implementation)
- **Blocked By**: None

**References** (CRITICAL):
- `packages/sms/src/provider/msg91.ts` - Current implementation
- `packages/editor/vitest.config.ts` - Vitest config pattern
- `.sisyphus/notepads/sms-integration/issues.md` - Issues to test

**Acceptance Criteria**:
- [x] Test file created
- [x] Phone normalization tests (10+ cases)
- [x] Timeout tests
- [x] Error classification tests
- [x] All tests FAIL (TDD requirement)
- [x] `pnpm test --filter=@repo/sms` runs tests

**Commit**: YES
- Message: `test(sms): add failing tests for provider fixes`

---

### - [x] 3. Fix Provider (Timeout, Validation, Errors)

**What to do**:
- Add AbortController with 15s timeout to `send()` method
- Implement strict phone validation:
  - Normalize all formats to `91XXXXXXXXXX`
  - Reject invalid numbers before API call
  - Handle: 10 digits, 0+10, 0091+10, +91+10, 91+10
  - Validate: must match `^91[6-9]\d{9}$`
- Improve error handling:
  - Parse response text, then JSON
  - Classify: 429 (retryable), 5xx (retryable), 401/403 (fatal), 4xx (fatal)
  - Include status, statusText, body excerpt in errors
  - Add `retryable` flag to error messages
- Fix unused `route` config (use it or remove it)
- Mask phone numbers in logs (e.g., `91XXXXX3210`)
- Watch tests turn GREEN

**Must NOT do**:
- Do NOT change SmsProvider interface
- Do NOT break existing callers
- Do NOT skip timeout implementation

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: [`test-driven-development`]

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2 (with Task 4)
- **Blocks**: None
- **Blocked By**: Task 2 (tests must exist first)

**References** (CRITICAL):
- `packages/sms/src/provider/msg91.test.ts` - Tests to pass
- `.sisyphus/notepads/sms-integration/issues.md` - Issues to fix

**Acceptance Criteria**:
- [x] AbortController with 15s timeout implemented
- [x] Strict phone validation implemented
- [x] Error classification implemented
- [x] Route config used or removed
- [x] Phone numbers masked in logs
- [x] ALL tests pass
- [x] `pnpm build --filter=@repo/sms` passes

**Commit**: YES
- Message: `fix(sms): add timeout, strict validation, and error classification to provider`

---

### - [x] 4. Add Tests for Worker (Atomic Claim, Shutdown)

**What to do**:
- Create `services/sms-worker/src/index.test.ts`
- Write tests for atomic claiming:
  - Two workers don't claim same message
  - Claim updates status atomically
  - Attempts incremented during claim
- Write tests for stuck message recovery:
  - Messages stuck in processing are requeued
  - Lease timeout works correctly
- Write tests for graceful shutdown:
  - In-flight batch completes before exit
  - No messages lost during shutdown
- Write tests for overlapping batch prevention
- All tests should FAIL initially (TDD)

**Must NOT do**:
- Do NOT implement fixes yet (tests first!)
- Do NOT skip concurrency tests
- Do NOT use mocks for database operations

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: [`test-driven-development`]

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2 (with Task 3)
- **Blocks**: Task 5 (implementation)
- **Blocked By**: Task 1 (needs schema with lease fields)

**References** (CRITICAL):
- `services/sms-worker/src/index.ts` - Current implementation
- `services/whatsapp-worker/src/index.ts` - Pattern reference
- `.sisyphus/notepads/sms-integration/issues.md` - Issues to test

**Acceptance Criteria**:
- [x] Test file created
- [x] Atomic claiming tests
- [x] Stuck message recovery tests
- [x] Graceful shutdown tests
- [x] Overlapping batch prevention tests
- [x] All tests FAIL (TDD requirement)
- [x] `pnpm test` runs tests in worker directory

**Commit**: YES
- Message: `test(sms-worker): add failing tests for concurrency and shutdown fixes`

---

### - [x] 5. Fix Worker (Atomic Claim, Graceful Shutdown)

**What to do**:
- Implement atomic claiming with `FOR UPDATE SKIP LOCKED`:
  - Single transaction: SELECT + UPDATE to processing
  - Increment attempts during claim
  - Set lockedAt, lockedBy, processingStartedAt
- Implement stuck message recovery:
  - Before claiming, reset stuck processing messages to pending
  - Stuck = lockedAt < now - 5 minutes
- Fix overlapping batches:
  - Replace setInterval with async loop
  - Or add isRunning guard
- Implement graceful shutdown:
  - Track currentBatchPromise
  - Await in-flight work with 30s timeout
  - Don't force-exit after 1s
- Fix exponential backoff:
  - Change to `Math.pow(2, attempts) * 30` seconds
- Watch tests turn GREEN

**Must NOT do**:
- Do NOT change public API
- Do NOT skip atomic claiming
- Do NOT skip graceful shutdown

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: [`test-driven-development`, `commit`]

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 3 (sequential)
- **Blocks**: Task 6 (integration tests)
- **Blocked By**: Task 1 (schema), Task 4 (tests)

**References** (CRITICAL):
- `services/sms-worker/src/index.test.ts` - Tests to pass
- `.sisyphus/notepads/sms-integration/ORACLE_REVIEW_SUMMARY.md` - Fix details

**Acceptance Criteria**:
- [x] Atomic claiming implemented with FOR UPDATE SKIP LOCKED
- [x] Stuck message recovery implemented
- [x] Overlapping batch prevention implemented
- [x] Graceful shutdown implemented
- [x] Exponential backoff fixed
- [x] ALL tests pass
- [x] `pnpm build` passes

**Commit**: YES
- Message: `fix(sms-worker): implement atomic claiming and graceful shutdown`

---

### - [x] 6. Add Integration Tests

**What to do**:
- Create `services/sms-worker/tests/integration.test.ts`
- Test end-to-end flow:
  - queueSms() → worker picks up → sends via provider → marks sent
- Test concurrency:
  - Start 2 workers, queue 10 messages, verify no duplicates
- Test failure recovery:
  - Queue message, kill worker mid-send, restart, verify recovery
- Test retry logic:
  - Queue message, simulate MSG91 failure, verify retries
- Test permanent failure:
  - Queue message with invalid number, verify marked as permanent failure

**Must NOT do**:
- Do NOT skip concurrency tests
- Do NOT use mocks for critical paths
- Do NOT skip failure scenarios

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: [`test-driven-development`]

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 3 (after Task 5)
- **Blocks**: None
- **Blocked By**: Task 5 (needs working implementation)

**References** (CRITICAL):
- `services/sms-worker/src/index.ts` - Implementation to test
- `packages/sms/src/util/send.ts` - queueSms function

**Acceptance Criteria**:
- [x] Integration test file created
- [x] End-to-end flow test
- [x] Concurrency test (2 workers, no duplicates)
- [x] Failure recovery test
- [x] Retry logic test
- [x] Permanent failure test
- [x] All tests pass
- [x] Tests run in CI

**Commit**: YES
- Message: `test(sms-worker): add integration tests for concurrency and recovery`

---

### - [x] 7. Fix Medium-Priority Issues

**What to do**:
- Optimize indexes:
  - Add partial indexes for immediate and scheduled queues
  - Remove redundant indexes
- Clarify organizationId:
  - Add comment explaining purpose
  - Or make optional if truly not needed
- Document phone number format:
  - Update schema comment to match actual format (`91XXXXXXXXXX`)
- Add monitoring/alerting recommendations to docs

**Must NOT do**:
- Do NOT break existing queries
- Do NOT change organizationId without understanding impact

**Recommended Agent Profile**:
- **Category**: `quick`
- **Skills**: [`commit`]

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 4 (final cleanup)
- **Blocks**: None
- **Blocked By**: Task 6 (all critical fixes done)

**References** (CRITICAL):
- `.sisyphus/notepads/sms-integration/ORACLE_REVIEW_SUMMARY.md` - Medium issues

**Acceptance Criteria**:
- [x] Partial indexes added
- [x] Redundant indexes removed
- [x] organizationId clarified
- [x] Phone format documented
- [x] `pnpm build` passes

**Commit**: YES
- Message: `fix(sms): optimize indexes and clarify schema documentation`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `fix(database): add lease and debug fields to sms_outbox` | Schema + migration | `pnpm build --filter=@repo/database` |
| 2 | `test(sms): add failing tests for provider fixes` | Provider tests | Tests fail as expected |
| 3 | `fix(sms): add timeout, strict validation, and error classification to provider` | Provider implementation | Tests pass |
| 4 | `test(sms-worker): add failing tests for concurrency and shutdown fixes` | Worker tests | Tests fail as expected |
| 5 | `fix(sms-worker): implement atomic claiming and graceful shutdown` | Worker implementation | Tests pass |
| 6 | `test(sms-worker): add integration tests for concurrency and recovery` | Integration tests | Tests pass |
| 7 | `fix(sms): optimize indexes and clarify schema documentation` | Schema + docs | `pnpm build` |

---

## Success Criteria

### Verification Commands
```bash
# All tests pass
pnpm test

# All builds pass
pnpm build

# Lint passes
pnpm lint

# Integration tests pass
cd services/sms-worker && pnpm test:integration

# Load test (manual)
# Start 2 workers, queue 100 messages, verify no duplicates
```

### Final Checklist
- [x] All 5 critical issues fixed
- [x] All 4 high-priority issues fixed
- [x] All tests pass
- [x] No duplicates in load testing
- [x] Worker recovers from crashes
- [x] Graceful shutdown works
- [x] Phone validation rejects invalid numbers
- [x] Request timeout prevents hangs
- [x] Error classification enables smart retries

---

## Pre-requisites

Before starting:
1. Review Oracle findings in `.sisyphus/notepads/sms-integration/ORACLE_REVIEW_SUMMARY.md`
2. Understand TDD workflow (test first, watch fail, implement, watch pass)
3. Have test database available for integration tests
4. Understand FOR UPDATE SKIP LOCKED in PostgreSQL
