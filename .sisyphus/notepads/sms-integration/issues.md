# SMS Integration - Issues

## Problems & Gotchas

(Subagents will append issues here)

## Oracle Review - SMS Worker Critical Issues

**Reviewed**: services/sms-worker/src/index.ts  
**Date**: 2026-01-28  
**Severity**: CRITICAL - Production Blocking

### Must-Fix Issues

#### 1. Race Condition: Duplicate Processing Across Workers
**Severity**: CRITICAL  
**Lines**: 16-42  
**Issue**: Non-atomic claim. Two worker instances can select the same pending message before either updates it to processing, causing duplicate SMS sends.

**Impact**: Users receive duplicate SMS, costs 2x, poor UX

#### 2. Overlapping Batches in Single Worker
**Severity**: CRITICAL  
**Line**: 77  
**Issue**: `setInterval` doesn't wait for `runBatch()` to complete. If MSG91 or DB is slow, multiple batches run concurrently, causing duplicates even with one process.

**Impact**: Duplicate sends, race conditions within single worker

#### 3. Messages Stuck in Processing Forever
**Severity**: HIGH  
**Lines**: 21-28, 37  
**Issue**: If process crashes after marking `processing` but before completion, message stays in `processing` forever. Worker only fetches `pending` messages.

**Impact**: Messages never sent, silent failures

#### 4. Non-Graceful Shutdown
**Severity**: HIGH  
**Lines**: 52-65  
**Issue**: Shutdown exits after 1s without awaiting in-flight DB updates or MSG91 requests. Can cause duplicates or stuck messages.

**Impact**: Data inconsistency, duplicate sends on restart

#### 5. Incorrect Backoff (Not Exponential)
**Severity**: MEDIUM  
**Line**: 12  
**Issue**: `30 * attempts` is linear, not exponential. If exponential was intended, this is wrong.

**Impact**: Retry timing not optimal, may hammer failing endpoints

### Recommended Fix (Atomic Claim + Graceful Shutdown)

**Priority 1**: Implement atomic claim with `FOR UPDATE SKIP LOCKED`
- Single DB transaction to select + update to processing
- Prevents duplicate processing across workers
- Increment attempts during claim

**Priority 2**: Prevent overlapping batches
- Use async loop instead of setInterval, or
- Guard with isRunning flag

**Priority 3**: Graceful shutdown
- Track currentBatchPromise
- Await in-flight work before exit (30s timeout)

**Priority 4**: Requeue stuck processing messages
- Add lease timeout check
- Reset processing → pending if updatedAt too old

**Effort**: 1-4 hours for atomic claim, 1-2 days for full solution with schema changes

## Oracle Review - MSG91 Provider Issues

**Reviewed**: packages/sms/src/provider/msg91.ts  
**Date**: 2026-01-28  
**Severity**: HIGH - Production Issues

### Critical Issues

#### 1. No Request Timeout - Worker Can Hang Forever
**Severity**: CRITICAL  
**Lines**: 78-85  
**Issue**: `fetch()` has no timeout. Network stalls can hang worker indefinitely, blocking all SMS processing.

**Impact**: Worker stalls, no SMS sent, requires restart

**Fix**: Add AbortController with 10-15s timeout

#### 2. Phone Normalization Too Permissive
**Severity**: HIGH  
**Lines**: 22-40, 68-75  
**Issue**: 
- Non-digits survive (only strips `[\s\-()]`)
- Non-Indian numbers not rejected
- Common variants not handled (`0XXXXXXXXXX`, `0091XXXXXXXXXX`)
- Empty/whitespace strings sent to API
- Warn-only, doesn't fail fast

**Impact**: Invalid numbers sent to MSG91, wasted API calls, costs

**Fix**: Strict validation, reject invalid numbers before API call

#### 3. Error Handling Loses Critical Details
**Severity**: HIGH  
**Lines**: 87-113  
**Issue**:
- Assumes `{type,message}` JSON shape
- Non-JSON bodies return only `HTTP ${status}`
- Doesn't distinguish 429/5xx (retryable) from 4xx (config error)
- Worker can't make intelligent retry decisions

**Impact**: Poor retry behavior, debugging difficult

**Fix**: Parse response properly, classify errors as retryable/fatal

#### 4. Unused Route Configuration
**Severity**: MEDIUM  
**Lines**: 6-10, 50-56, 70-75  
**Issue**: `route` exists in config but never used in API call

**Impact**: Confusion, potential misconfiguration

#### 5. PII in Logs
**Severity**: MEDIUM  
**Lines**: 115-118, 92-95  
**Issue**: Full phone numbers logged at info level, provider responses may contain PII

**Impact**: Privacy/compliance risk

### Recommended Fixes (Priority Order)

**Priority 1**: Add request timeout (CRITICAL)
- Use AbortController with 10-15s timeout
- Return clear error message for worker retry logic

**Priority 2**: Strict phone validation (HIGH)
- Validate before API call, fail fast
- Handle: 10 digits, 0+10 digits, 0091+10 digits
- Reject non-Indian numbers (or gate with config flag)
- Minimum: match `^91[6-9]\d{9}$` for Indian mobiles

**Priority 3**: Better error classification (HIGH)
- Parse response text, then JSON
- Special-case 429 (rate limit), 5xx (server), 401/403 (auth), 4xx (validation)
- Include status, statusText, body excerpt in errors
- Consider adding `retryable` flag to SmsSendResult

**Effort**: 2-4 hours for all three fixes

## Oracle Review - Database Schema Issues

**Reviewed**: packages/database/drizzle/schema/sms.ts  
**Date**: 2026-01-28  
**Severity**: HIGH - Schema Improvements Needed

### Schema Issues

#### 1. No Lease/Lock Support for Crash Recovery
**Severity**: CRITICAL  
**Lines**: 18-23, 47-52  
**Issue**: No `lockedAt`, `lockedBy`, or `processingStartedAt` fields. Can't recover stuck `processing` messages after worker crash.

**Impact**: Messages stuck forever if worker crashes mid-processing

**Fix**: Add lease fields for atomic claiming

#### 2. organizationId Required But Semantically Unclear
**Severity**: MEDIUM  
**Lines**: 37  
**Issue**: Required field but plan says "platform provides SMS (single account)". Semantic mismatch.

**Impact**: Confusion, potential backfill issues

**Fix**: Consider making optional or clarify purpose

#### 3. Phone Number Format Inconsistency
**Severity**: MEDIUM  
**Line**: 38  
**Issue**: Comment says E.164 but MSG91 provider uses `91XXXXXXXXXX`. Mixed formats will complicate dedupe/debug.

**Impact**: Inconsistent data, harder debugging

**Fix**: Normalize consistently to one format

#### 4. Incomplete Retry/Debug Metadata
**Severity**: HIGH  
**Lines**: 42-45  
**Issue**: Missing `lastAttemptAt`, structured error codes, failure classification. Only free-text `errorMessage`.

**Impact**: Poor debugging, can't distinguish retryable vs permanent failures

**Fix**: Add operational fields

#### 5. Suboptimal Indexes for Worker Query
**Severity**: MEDIUM  
**Lines**: 55-59  
**Issue**: Worker queries `status='pending' AND (nextAttemptAt IS NULL OR nextAttemptAt <= now)`. Can't efficiently use `(status,nextAttemptAt)` index due to OR.

**Impact**: Performance degradation at scale

**Fix**: Use partial indexes

### Recommended Schema Changes

**Priority 1**: Add lease fields (CRITICAL for production)
```sql
ALTER TABLE sms_outbox ADD COLUMN locked_at timestamptz;
ALTER TABLE sms_outbox ADD COLUMN locked_by text;
ALTER TABLE sms_outbox ADD COLUMN processing_started_at timestamptz;
```

**Priority 2**: Add operational fields
```sql
ALTER TABLE sms_outbox ADD COLUMN last_attempt_at timestamptz;
ALTER TABLE sms_outbox ADD COLUMN provider_status_code integer;
ALTER TABLE sms_outbox ADD COLUMN error_code text;
ALTER TABLE sms_outbox ADD COLUMN is_permanent_failure boolean DEFAULT false;
```

**Priority 3**: Improve indexes
```sql
-- Partial indexes for better performance
CREATE INDEX sms_outbox_immediate_queue_idx 
  ON sms_outbox (id) 
  WHERE status='pending' AND next_attempt_at IS NULL;

CREATE INDEX sms_outbox_scheduled_queue_idx 
  ON sms_outbox (next_attempt_at) 
  WHERE status='pending' AND next_attempt_at IS NOT NULL;
```

**Effort**: 1-2 hours for migration, 2-4 hours for worker updates
