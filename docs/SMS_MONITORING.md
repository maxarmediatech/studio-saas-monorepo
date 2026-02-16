# SMS Integration - Monitoring & Alerting Recommendations

## Overview

This document provides monitoring and alerting recommendations for the SMS integration to ensure production reliability and quick incident response.

---

## Key Metrics to Monitor

### 1. Queue Health

**Metric**: Pending Message Count
- **Query**: `SELECT COUNT(*) FROM sms_outbox WHERE status = 'pending'`
- **Alert Threshold**: > 1000 messages
- **Severity**: WARNING
- **Action**: Check worker logs, verify MSG91 connectivity

**Metric**: Processing Message Count
- **Query**: `SELECT COUNT(*) FROM sms_outbox WHERE status = 'processing'`
- **Alert Threshold**: > 100 messages (indicates stuck messages)
- **Severity**: CRITICAL
- **Action**: Check for worker crashes, verify lease timeout recovery

**Metric**: Failed Message Count
- **Query**: `SELECT COUNT(*) FROM sms_outbox WHERE status = 'failed'`
- **Alert Threshold**: > 50 messages in 1 hour
- **Severity**: WARNING
- **Action**: Review error codes, check phone number validation

### 2. Worker Performance

**Metric**: Batch Processing Time
- **Source**: Worker logs (time between batch start and completion)
- **Alert Threshold**: > 30 seconds
- **Severity**: WARNING
- **Action**: Check MSG91 response times, database query performance

**Metric**: Overlapping Batches Skipped
- **Source**: Worker stats (`overlapsSkipped` counter)
- **Alert Threshold**: > 5 skips per minute
- **Severity**: WARNING
- **Action**: Increase poll interval or add more worker instances

**Metric**: Worker Crashes
- **Source**: Process exit logs
- **Alert Threshold**: Any crash
- **Severity**: CRITICAL
- **Action**: Check logs for panic/error, verify database connectivity

### 3. Provider Integration

**Metric**: MSG91 API Success Rate
- **Query**: `SELECT COUNT(*) FILTER (WHERE status = 'sent') / COUNT(*) FROM sms_outbox WHERE created_at > NOW() - INTERVAL '1 hour'`
- **Alert Threshold**: < 95%
- **Severity**: WARNING
- **Action**: Check MSG91 status page, verify API credentials

**Metric**: MSG91 Rate Limit Hits
- **Query**: `SELECT COUNT(*) FROM sms_outbox WHERE error_code = 'RATE_LIMIT' AND created_at > NOW() - INTERVAL '1 hour'`
- **Alert Threshold**: > 10 in 1 hour
- **Severity**: WARNING
- **Action**: Reduce batch size or increase poll interval

**Metric**: MSG91 Timeout Errors
- **Query**: `SELECT COUNT(*) FROM sms_outbox WHERE error_code = 'TIMEOUT' AND created_at > NOW() - INTERVAL '1 hour'`
- **Alert Threshold**: > 5 in 1 hour
- **Severity**: WARNING
- **Action**: Check MSG91 network latency, increase timeout if needed

### 4. Data Quality

**Metric**: Invalid Phone Numbers
- **Query**: `SELECT COUNT(*) FROM sms_outbox WHERE is_permanent_failure = true AND error_code = 'INVALID_PHONE' AND created_at > NOW() - INTERVAL '1 hour'`
- **Alert Threshold**: > 100 in 1 hour
- **Severity**: INFO
- **Action**: Review phone number source, improve validation upstream

**Metric**: Permanent Failures
- **Query**: `SELECT COUNT(*) FROM sms_outbox WHERE is_permanent_failure = true AND created_at > NOW() - INTERVAL '1 hour'`
- **Alert Threshold**: > 50 in 1 hour
- **Severity**: WARNING
- **Action**: Review error codes, check for API credential issues

### 5. Retry Behavior

**Metric**: Messages Exceeding Max Attempts
- **Query**: `SELECT COUNT(*) FROM sms_outbox WHERE attempts >= max_attempts AND status = 'pending'`
- **Alert Threshold**: > 10 messages
- **Severity**: WARNING
- **Action**: Check for stuck messages, verify lease timeout recovery

**Metric**: Average Retry Count
- **Query**: `SELECT AVG(attempts) FROM sms_outbox WHERE status = 'sent' AND created_at > NOW() - INTERVAL '1 hour'`
- **Alert Threshold**: > 2.0 (indicates frequent failures)
- **Severity**: INFO
- **Action**: Monitor error patterns, consider adjusting backoff strategy

---

## Recommended Dashboards

### Real-Time Operations Dashboard

Display these metrics with 1-minute refresh:
- Pending message count (gauge)
- Processing message count (gauge)
- Messages sent in last hour (counter)
- Worker status (online/offline)
- Latest batch processing time (gauge)
- MSG91 API success rate (percentage)

### Incident Investigation Dashboard

For troubleshooting:
- Error code distribution (pie chart)
- Failed messages by organization (table)
- Stuck messages (processing > 5 min) (table)
- Worker crash history (timeline)
- MSG91 rate limit hits (time series)
- Phone validation failures (time series)

---

## Alerting Rules

### Critical Alerts (Page On-Call)

1. **Worker Down**
   - Condition: No heartbeat in 5 minutes
   - Action: Restart worker, check logs

2. **Processing Queue Stuck**
   - Condition: > 100 messages in processing for > 10 minutes
   - Action: Check worker logs, verify database connectivity

3. **MSG91 API Unavailable**
   - Condition: > 50% failure rate in last 5 minutes
   - Action: Check MSG91 status page, verify credentials

### Warning Alerts (Slack Notification)

1. **High Pending Queue**
   - Condition: > 1000 pending messages
   - Action: Monitor, may need to scale workers

2. **High Failure Rate**
   - Condition: > 10% failure rate in last hour
   - Action: Review error codes, check data quality

3. **Batch Processing Slow**
   - Condition: > 30 seconds per batch
   - Action: Check MSG91 latency, database performance

4. **Rate Limit Approaching**
   - Condition: > 5 rate limit errors in 1 hour
   - Action: Reduce batch size or increase poll interval

---

## Logging Best Practices

### What to Log

1. **Batch Start/End**
   ```
   [BATCH_START] worker_id=worker-1 batch_size=100 timestamp=2026-01-28T10:30:00Z
   [BATCH_END] worker_id=worker-1 sent=98 failed=2 duration_ms=2500
   ```

2. **Message Processing**
   ```
   [MSG_SENT] msg_id=abc123 phone=91XXXXXX3210 provider_msg_id=msg91-xyz
   [MSG_FAILED] msg_id=abc123 error_code=INVALID_PHONE attempt=1 next_retry=2026-01-28T10:35:00Z
   ```

3. **Worker Events**
   ```
   [WORKER_START] worker_id=worker-1 poll_interval_ms=5000
   [WORKER_SHUTDOWN] worker_id=worker-1 in_flight=0 duration_ms=500
   [WORKER_CRASH] worker_id=worker-1 error="database connection lost"
   ```

4. **Recovery Events**
   ```
   [RECOVERY_START] worker_id=worker-1 stuck_threshold_min=5
   [RECOVERY_COMPLETE] worker_id=worker-1 recovered_count=5
   ```

### What NOT to Log

- Full phone numbers (use masked format: `91XXXXXX3210`)
- API credentials or auth tokens
- Customer PII beyond what's necessary for debugging
- Full error stack traces (summarize instead)

---

## Operational Runbooks

### Incident: High Pending Queue

**Symptoms**: Pending message count > 1000

**Investigation**:
1. Check worker status: `SELECT COUNT(*) FROM sms_outbox WHERE status = 'processing'`
2. Check worker logs for errors
3. Verify MSG91 API connectivity
4. Check database query performance

**Resolution**:
- If worker is down: Restart worker service
- If MSG91 is slow: Wait for recovery or contact MSG91 support
- If database is slow: Check for long-running queries, optimize indexes

### Incident: Stuck Messages in Processing

**Symptoms**: > 100 messages in processing status for > 10 minutes

**Investigation**:
1. Check worker logs for crashes
2. Verify database connectivity
3. Check `processing_started_at` timestamps

**Resolution**:
1. Run stuck message recovery:
   ```sql
   UPDATE sms_outbox 
   SET status = 'pending', locked_at = NULL, locked_by = NULL, processing_started_at = NULL
   WHERE status = 'processing' AND processing_started_at < NOW() - INTERVAL '5 minutes';
   ```
2. Restart worker to pick up recovered messages
3. Investigate root cause (worker crash, database issue, etc.)

### Incident: High Failure Rate

**Symptoms**: > 10% of messages failing in last hour

**Investigation**:
1. Check error code distribution:
   ```sql
   SELECT error_code, COUNT(*) FROM sms_outbox 
   WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour'
   GROUP BY error_code;
   ```
2. Check for invalid phone numbers
3. Check MSG91 API status

**Resolution**:
- If `INVALID_PHONE`: Review phone number source, improve validation
- If `RATE_LIMIT`: Reduce batch size, increase poll interval
- If `TIMEOUT`: Check MSG91 latency, increase timeout
- If `AUTH_ERROR`: Verify API credentials

---

## Capacity Planning

### Scaling Indicators

**Add More Workers When**:
- Pending queue > 5000 messages
- Average batch processing time > 20 seconds
- Overlapping batches skipped > 10 per minute

**Optimize Database When**:
- Batch query time > 5 seconds
- Lock contention detected
- Index scan instead of seek

**Increase MSG91 Quota When**:
- Rate limit errors > 20 per hour
- Approaching daily message limit

---

## Testing & Validation

### Load Testing Checklist

- [ ] Test with 10,000+ pending messages
- [ ] Verify no duplicates with 2+ workers
- [ ] Simulate MSG91 timeout (15s+)
- [ ] Simulate MSG91 rate limit (429 response)
- [ ] Simulate worker crash mid-batch
- [ ] Verify stuck message recovery
- [ ] Verify graceful shutdown under load

### Monitoring Validation

- [ ] All alerts fire correctly
- [ ] Dashboard metrics update in real-time
- [ ] Logs are searchable and parseable
- [ ] No sensitive data in logs
- [ ] Retention policy enforced

---

## References

- [SMS Integration Architecture](./ARCHITECTURE.md)
- [Oracle Review - SMS Integration](../.sisyphus/notepads/sms-integration/ORACLE_REVIEW_SUMMARY.md)
- [MSG91 API Documentation](https://www.msg91.com/api/)
