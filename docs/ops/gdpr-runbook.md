# GDPR Data Deletion Runbook

This document describes how to verify and execute the full GDPR data deletion lifecycle for a user account.

## Overview

The deletion flow:
1. User submits `requestAccountDeletion` → creates `DataDeletionRequest`, sets `User.status = PENDING_DELETION`
2. Nightly purge worker (`/api/cron/purge-deletions`) processes requests where `scheduledAt <= now` and `processedAt IS NULL`
3. Worker hard-deletes personal data, anonymizes audit logs, purges Firebase Storage objects

Grace period: configurable via `GDPR_DELETION_GRACE_DAYS` (default: 30 days).

## Step-by-Step Verification

### 1. Create test user
- Sign up with a test email and create journal entries + voice notes + mood check-ins
- Verify data exists:
  ```sql
  SELECT id, email, status FROM User WHERE email = 'test@example.com';
  SELECT COUNT(*) FROM JournalEntry WHERE userId = '<userId>';
  SELECT COUNT(*) FROM VoiceNote WHERE entry_id IN (SELECT id FROM JournalEntry WHERE userId = '<userId>');
  ```

### 2. Request deletion
- Call `requestAccountDeletion` via the profile settings page (or directly via the server action)
- Verify:
  ```sql
  SELECT * FROM DataDeletionRequest WHERE userId = '<userId>';
  -- scheduledAt should be NOW() + GDPR_DELETION_GRACE_DAYS
  -- processedAt should be NULL (scheduled state)
  SELECT status FROM User WHERE id = '<userId>';
  -- should be PENDING_DELETION
  ```

### 3. Fast-forward for testing
- Update `scheduledAt` to a past timestamp:
  ```sql
  UPDATE DataDeletionRequest SET scheduledAt = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE userId = '<userId>';
  ```

### 4. Trigger purge worker
- Via cron endpoint (requires `CRON_SECRET`):
  ```bash
  curl -X POST http://localhost:3000/api/cron/purge-deletions \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
- Or run the worker directly and wait for the job to process.

### 5. Verify clean-up
```sql
-- User row should be hard-deleted (or anonymized if payments exist)
SELECT id FROM User WHERE id = '<userId>';
-- Should return empty

-- Journal entries hard-deleted
SELECT COUNT(*) FROM JournalEntry WHERE userId = '<userId>';
-- Should be 0

-- Audit logs anonymized (userId replaced with NULL or redacted marker)
SELECT targetUserId FROM AdminAuditLog WHERE targetUserId = '<userId>';
-- Should be 0 (anonymized)

-- DataDeletionRequest processedAt set
SELECT processedAt FROM DataDeletionRequest WHERE userId = '<userId>';
-- Should be a timestamp
```

### 6. Verify Firebase Storage
- Check Firebase Console → Storage for the user's avatar and voice note paths
- Paths follow pattern: `users/<userId>/avatar.*` and `journal/<entryId>/voice-notes/*`
- Both should be absent after purge completes

### 7. Verify payments retained
```sql
-- Payment rows should remain but with userId = NULL per retention policy
SELECT userId FROM Payment WHERE id IN (SELECT id FROM Payment WHERE userId = '<userId>');
-- userId should be NULL (anonymized, not deleted)
```

## Cancellation Flow
- User can cancel deletion while `scheduledAt > NOW()` via `cancelAccountDeletion`
- Verify: `User.status` returns to `ACTIVE`, `DataDeletionRequest` row deleted

## Retention Policy
| Data Type | Action on Deletion |
|-----------|-------------------|
| JournalEntry / VoiceNote | Hard delete |
| CardUnlock / SavedCard | Hard delete |
| MoodCheckIn / CardDraw | Hard delete |
| Payment | Retain, userId → NULL |
| AdminAuditLog | Retain, targetUserId → anonymized |
| FcmToken | Hard delete |
| Subscription | Hard delete |

## Re-running Purge (Idempotency)
The purge worker queries `processedAt IS NULL` — already-processed requests are skipped. Re-running is safe.
