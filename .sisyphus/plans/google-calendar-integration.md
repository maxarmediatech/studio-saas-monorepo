# Google Calendar Integration for Crew Shoot Assignments

## Context

### Original Request
Integrate Google Calendar with crew shoot assignments such that when a crew member is assigned to a shoot, optionally create/update a Google Calendar event and invite the crew member.

### Interview Summary
**Key Discussions**:
- Architecture: Each crew member connects their own Google Calendar (per-user OAuth, not org-level)
- Sync behavior: Opt-in per shoot via toggle on shoot detail page
- Unassignment: Remove crew from event attendees (event persists for remaining crew)
- Update sync: Auto-sync shoot changes (date/time/venue) to calendar
- Processing: Background job using outbox pattern (like WhatsApp worker)
- Non-user crew: Send .ics email fallback automatically on assignment
- Event content: Full details (title with booking ref, venue, notes, role, link)
- UI: New Settings > Integrations page for Google Calendar connection

**Research Findings**:
- Current Google OAuth only has `email,profile` scopes - need separate calendar OAuth
- Better-auth handles login OAuth; calendar connection needs independent flow
- Existing outbox pattern in `services/whatsapp-worker` provides proven template
- Crew table has optional `userId` - only users can connect Google
- Crew without `userId` but WITH email can receive .ics fallback
- `shoots` table has `shootDate`, `startTime`, `endTime`, `venue` for event data

### Gap Analysis (Self-Review)
**Identified Gaps Addressed**:
1. Token refresh handling - tokens expire, need refresh utility
2. Google API rate limits - need backoff in worker
3. Concurrent assignment handling - multiple crew assigned simultaneously
4. Timezone handling - shoots have date/time but no explicit timezone
5. Email delivery for .ics - need email template
6. Permission model - who can enable calendar sync on shoots
7. Audit trail - track calendar sync actions for debugging
8. Disconnection handling - what happens to events when crew disconnects Google

---

## Work Objectives

### Core Objective
Enable crew members to receive Google Calendar events for shoots they're assigned to, with automatic sync of changes and proper cleanup on unassignment.

### Concrete Deliverables
1. Database schema: `google_calendar_connections`, `calendar_sync_jobs`, `shoot_calendar_events` tables
2. Schema migration: Add `calendarSyncEnabled` to `shoots` table
3. Google OAuth flow: Separate calendar-specific OAuth with `calendar.events` scope
4. Token management: Refresh utility for expired tokens
5. Background worker: `services/calendar-worker` for async event processing
6. API procedures: Connect/disconnect Google, list connections, toggle shoot sync
7. Assignment hooks: Enqueue calendar jobs on assign/unassign
8. Shoot update hooks: Enqueue calendar jobs on shoot edit
9. .ics email fallback: Template and send logic for non-connected crew
10. UI: Settings > Integrations page with Google Calendar card
11. UI: Shoot detail page calendar sync toggle

### Definition of Done
- [ ] Crew can connect Google Calendar from Settings > Integrations
- [ ] When crew is assigned to a calendar-enabled shoot, event appears in their Google Calendar
- [ ] Shoot updates (date/time/venue) sync to all crew calendars
- [ ] Unassigning crew removes event from their calendar
- [ ] Crew without Google connection receives .ics email
- [ ] All operations are processed asynchronously with retry on failure

### Must Have
- Per-crew Google Calendar OAuth connection
- Background job processing with retry logic
- Event create/update/delete on crew calendars
- .ics email fallback for non-connected crew
- Shoot-level toggle to enable/disable calendar sync
- Token refresh handling

### Must NOT Have (Guardrails)
- NO service account or domain-wide delegation
- NO calendar selection UI (always use primary calendar)
- NO bidirectional sync (calendar changes don't update app)
- NO webhook subscription for external calendar changes
- NO modifications to existing login OAuth flow
- NO feature flags - ship directly
- NO unit tests (manual QA only per user preference)
- NO calendar events for crew without email (skip silently)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Playwright in `apps/web/tests`)
- **User wants tests**: NO - Manual QA only
- **Framework**: N/A

### Manual QA Procedures

Each TODO includes detailed verification using:
- **Backend**: curl commands, database queries
- **Frontend**: Playwright browser automation for UI verification
- **Calendar**: Real Google Calendar account for integration testing

**Test Prerequisites**:
- Google Cloud project with Calendar API enabled
- OAuth credentials (client ID/secret) configured
- Test Google account for calendar operations
- Test crew member with email for .ics testing

---

## Task Flow

```
Phase 1: Database & Schema
    Task 1 (schema) → Task 2 (migration)

Phase 2: Core Infrastructure  
    Task 3 (OAuth flow) → Task 4 (token refresh) → Task 5 (Google Calendar service)

Phase 3: Background Processing
    Task 6 (outbox table) → Task 7 (worker service)

Phase 4: API Layer
    Task 8 (connection procedures) → Task 9 (shoot sync toggle) → Task 10 (assignment hooks)

Phase 5: Email Fallback
    Task 11 (.ics generation) → Task 12 (email template)

Phase 6: UI
    Task 13 (Integrations page) → Task 14 (shoot toggle UI)

Phase 7: Integration & Polish
    Task 15 (shoot update hooks) → Task 16 (disconnect cleanup) → Task 17 (end-to-end QA)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 3, 6 | OAuth flow and outbox schema are independent |
| B | 11, 13 | .ics generation and UI can be built in parallel |

| Task | Depends On | Reason |
|------|------------|--------|
| 2 | 1 | Migration depends on schema definition |
| 4 | 3 | Token refresh needs OAuth flow |
| 5 | 4 | Calendar service needs token management |
| 7 | 5, 6 | Worker needs service and outbox |
| 8 | 3 | API needs OAuth flow |
| 10 | 7, 8 | Hooks need worker and API |
| 12 | 11 | Email needs .ics generator |
| 14 | 9, 13 | Shoot UI needs API and base UI |

---

## TODOs

### Phase 1: Database & Schema

- [ ] 1. Define Google Calendar integration schema

  **What to do**:
  - Create `packages/database/drizzle/schema/integrations.ts` with three tables:
    - `google_calendar_connections`: userId, accessToken, refreshToken, expiresAt, scope, calendarId (nullable), connectedAt, disconnectedAt
    - `calendar_sync_jobs`: outbox table with status, attempts, jobType, payload, shootId, crewId, errorMessage, nextAttemptAt
    - `shoot_calendar_events`: shootId, crewId, googleEventId, calendarId, syncStatus, lastSyncedAt
  - Add proper indexes for query performance
  - Add relations to existing tables (users, shoots, crews)

  **Must NOT do**:
  - Do NOT modify existing `accounts` table
  - Do NOT add calendar fields directly to `shoots` or `crews` tables

  **Parallelizable**: NO (foundation for all other tasks)

  **References**:
  - `packages/database/drizzle/schema/studio.ts:456-488` - shootAssignments table pattern
  - `packages/whatsapp-db/drizzle/schema/outbox.ts:12-43` - outbox table pattern with status, attempts, nextAttemptAt
  - `packages/database/drizzle/schema/auth.ts:67-90` - OAuth token storage pattern

  **Acceptance Criteria**:
  - [ ] File `packages/database/drizzle/schema/integrations.ts` exists
  - [ ] Schema exported from `packages/database/drizzle/schema/index.ts`
  - [ ] `pnpm db:generate` succeeds in `packages/database`
  - [ ] Generated SQL shows three new tables with correct columns

  **Commit**: YES
  - Message: `feat(database): add google calendar integration schema`
  - Files: `packages/database/drizzle/schema/integrations.ts`, `packages/database/drizzle/schema/index.ts`

---

- [ ] 2. Add calendarSyncEnabled field to shoots table

  **What to do**:
  - Add `calendarSyncEnabled` boolean field to `shoots` table in `studio.ts`
  - Default to `false` (opt-in per shoot)
  - Generate and run migration

  **Must NOT do**:
  - Do NOT make it org-level setting
  - Do NOT auto-enable for existing shoots

  **Parallelizable**: NO (depends on 1)

  **References**:
  - `packages/database/drizzle/schema/studio.ts:399-454` - shoots table definition

  **Acceptance Criteria**:
  - [ ] `shoots` table has `calendarSyncEnabled` column
  - [ ] `pnpm db:generate` creates migration file
  - [ ] `pnpm db:migrate` applies successfully
  - [ ] Query `SELECT calendar_sync_enabled FROM shoots LIMIT 1` works

  **Commit**: YES
  - Message: `feat(database): add calendarSyncEnabled to shoots`
  - Files: `packages/database/drizzle/schema/studio.ts`, migration file

---

### Phase 2: Core Infrastructure

- [ ] 3. Implement Google Calendar OAuth flow

  **What to do**:
  - Create `packages/integrations/google-calendar/oauth.ts` with:
    - `getAuthUrl()` - generate OAuth URL with `calendar.events` scope
    - `exchangeCode(code)` - exchange auth code for tokens
    - `revokeToken(token)` - revoke access on disconnect
  - Use `googleapis` npm package
  - Store tokens in `google_calendar_connections` table
  - Handle OAuth callback in Next.js API route

  **Must NOT do**:
  - Do NOT reuse better-auth OAuth flow
  - Do NOT request full calendar access (only `calendar.events` scope)

  **Parallelizable**: YES (with Task 6)

  **References**:
  - `packages/auth/auth.ts:389-400` - existing Google provider config (for client ID/secret env vars)
  - Google Calendar API docs: OAuth 2.0 for Web Server Applications

  **Acceptance Criteria**:
  - [ ] `packages/integrations/google-calendar/oauth.ts` exists
  - [ ] Environment variables: `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` documented
  - [ ] Manual test: Navigate to auth URL → complete OAuth → token stored in DB
  - [ ] Query `SELECT * FROM google_calendar_connections WHERE user_id = ?` returns token

  **Commit**: YES
  - Message: `feat(integrations): add google calendar oauth flow`
  - Files: `packages/integrations/google-calendar/*`

---

- [ ] 4. Implement token refresh utility

  **What to do**:
  - Create `packages/integrations/google-calendar/token-manager.ts`:
    - `getValidToken(userId)` - returns valid access token, refreshing if expired
    - `isTokenExpired(connection)` - check if token needs refresh
    - `refreshToken(connection)` - use refresh token to get new access token
  - Update `google_calendar_connections` on refresh
  - Handle refresh token revocation gracefully

  **Must NOT do**:
  - Do NOT cache tokens in memory (always check DB)
  - Do NOT throw on expired refresh token (mark connection as disconnected)

  **Parallelizable**: NO (depends on 3)

  **References**:
  - `packages/integrations/google-calendar/oauth.ts` - OAuth implementation from Task 3
  - Google OAuth token refresh docs

  **Acceptance Criteria**:
  - [ ] `getValidToken(userId)` returns fresh token
  - [ ] Expired token triggers refresh automatically
  - [ ] After refresh, DB has new accessToken and expiresAt
  - [ ] Invalid refresh token marks connection as disconnected

  **Commit**: YES
  - Message: `feat(integrations): add token refresh for google calendar`
  - Files: `packages/integrations/google-calendar/token-manager.ts`

---

- [ ] 5. Create Google Calendar service wrapper

  **What to do**:
  - Create `packages/integrations/google-calendar/calendar-service.ts`:
    - `createEvent(userId, eventData)` - create event on user's primary calendar
    - `updateEvent(userId, eventId, eventData)` - update existing event
    - `deleteEvent(userId, eventId)` - delete event
    - `getEvent(userId, eventId)` - fetch event details
  - Use `googleapis` calendar API
  - Integrate with token manager for auth
  - Handle API errors with proper error types

  **Must NOT do**:
  - Do NOT allow calendar selection (always primary)
  - Do NOT expose raw googleapis types

  **Parallelizable**: NO (depends on 4)

  **References**:
  - `packages/integrations/google-calendar/token-manager.ts` - token management from Task 4
  - `packages/whatsapp-providers/src/providers/cloud-api/messaging.ts` - external API wrapper pattern

  **Acceptance Criteria**:
  - [ ] Create event: `createEvent(userId, {...})` returns `{ eventId, eventLink }`
  - [ ] Update event: `updateEvent(userId, eventId, {...})` succeeds
  - [ ] Delete event: `deleteEvent(userId, eventId)` succeeds
  - [ ] Manual test: Event visible in Google Calendar web UI

  **Commit**: YES
  - Message: `feat(integrations): add google calendar service wrapper`
  - Files: `packages/integrations/google-calendar/calendar-service.ts`, `packages/integrations/google-calendar/index.ts`

---

### Phase 3: Background Processing

- [ ] 6. Create calendar sync jobs outbox table and enums

  **What to do**:
  - Add enum `calendarJobTypeEnum` in `packages/database/drizzle/schema/enums.ts`:
    - `create_event`, `update_event`, `delete_event`, `send_ics`
  - Add enum `calendarJobStatusEnum`:
    - `pending`, `processing`, `completed`, `failed`
  - Ensure `calendar_sync_jobs` table uses these enums

  **Must NOT do**:
  - Do NOT create separate package for calendar DB (keep in main database package)

  **Parallelizable**: YES (with Task 3)

  **References**:
  - `packages/database/drizzle/schema/enums.ts` - existing enum patterns
  - `packages/whatsapp-db/drizzle/schema/enums.ts:38` - outbox status enum pattern

  **Acceptance Criteria**:
  - [ ] Enums defined in `packages/database/drizzle/schema/enums.ts`
  - [ ] `calendar_sync_jobs` table uses proper enum types
  - [ ] `pnpm db:generate` succeeds

  **Commit**: YES (group with Task 1 if done together)
  - Message: `feat(database): add calendar job enums`
  - Files: `packages/database/drizzle/schema/enums.ts`

---

- [ ] 7. Create calendar worker service

  **What to do**:
  - Create `services/calendar-worker/` directory structure:
    - `package.json` with dependencies
    - `src/index.ts` - main polling loop
    - `src/processors/create-event.ts` - handle event creation
    - `src/processors/update-event.ts` - handle event updates
    - `src/processors/delete-event.ts` - handle event deletion
    - `src/processors/send-ics.ts` - handle .ics email sending
  - Implement polling loop (5s interval, configurable)
  - Implement exponential backoff for retries
  - Add to root `package.json` scripts

  **Must NOT do**:
  - Do NOT use external queue (BullMQ, etc.) - use DB polling
  - Do NOT process more than 10 jobs per batch

  **Parallelizable**: NO (depends on 5, 6)

  **References**:
  - `services/whatsapp-worker/src/index.ts:370-397` - polling loop pattern
  - `services/whatsapp-worker/src/index.ts:15-18` - exponential backoff calculation
  - `services/whatsapp-worker/src/index.ts:45-111` - job status update patterns

  **Acceptance Criteria**:
  - [ ] `services/calendar-worker/` directory exists with all files
  - [ ] `pnpm --filter calendar-worker dev` starts worker
  - [ ] Worker logs: "Calendar sync worker started"
  - [ ] Insert test job → worker processes it → status becomes `completed`

  **Commit**: YES
  - Message: `feat(services): add calendar sync worker`
  - Files: `services/calendar-worker/*`

---

### Phase 4: API Layer

- [ ] 8. Create Google Calendar connection procedures

  **What to do**:
  - Create `packages/api/modules/integrations/` module:
    - `router.ts` - register routes
    - `procedures/connect-google-calendar.ts` - initiate OAuth, return auth URL
    - `procedures/callback-google-calendar.ts` - handle OAuth callback
    - `procedures/disconnect-google-calendar.ts` - revoke and delete connection
    - `procedures/get-google-calendar-status.ts` - check connection status
    - `schemas.ts` - Zod schemas for input/output
  - Use `studioProtectedProcedure` for all endpoints
  - Register router in main API router

  **Must NOT do**:
  - Do NOT expose raw tokens in API responses
  - Do NOT allow connecting multiple Google accounts per user

  **Parallelizable**: NO (depends on 3)

  **References**:
  - `packages/api/modules/whatsapp/procedures/connect-cloud-api.ts` - connection procedure pattern
  - `packages/api/orpc/procedures.ts` - procedure base definitions
  - `packages/api/orpc/router.ts` - router aggregation pattern

  **Acceptance Criteria**:
  - [ ] `POST /api/integrations/google-calendar/connect` returns auth URL
  - [ ] `GET /api/integrations/google-calendar/callback?code=...` stores tokens
  - [ ] `DELETE /api/integrations/google-calendar/disconnect` removes connection
  - [ ] `GET /api/integrations/google-calendar/status` returns `{ connected: boolean, email?: string }`

  **Commit**: YES
  - Message: `feat(api): add google calendar connection procedures`
  - Files: `packages/api/modules/integrations/*`

---

- [ ] 9. Create shoot calendar sync toggle procedure

  **What to do**:
  - Create `packages/api/modules/shoots/procedures/toggle-calendar-sync.ts`:
    - Input: `{ shootId, enabled: boolean }`
    - Validate shoot exists and user has permission
    - Update `shoots.calendarSyncEnabled`
    - If enabling and shoot has assignments, enqueue `create_event` jobs for connected crew
    - If disabling, enqueue `delete_event` jobs for all crew
  - Add to shoots router

  **Must NOT do**:
  - Do NOT auto-enable sync when assignments exist
  - Do NOT delete events immediately (use background job)

  **Parallelizable**: NO (depends on 7, 8)

  **References**:
  - `packages/api/modules/shoots/procedures/assign-crew.ts` - shoot procedure pattern
  - `packages/api/modules/studio/schemas/shoot.ts` - shoot schema patterns

  **Acceptance Criteria**:
  - [ ] `PATCH /api/shoots/{shootId}/calendar-sync` toggles sync
  - [ ] Enabling sync for shoot with 2 assigned crew → 2 jobs enqueued
  - [ ] Disabling sync → delete jobs enqueued for existing events
  - [ ] Response: `{ data: { calendarSyncEnabled: boolean }, message: string }`

  **Commit**: YES
  - Message: `feat(api): add shoot calendar sync toggle`
  - Files: `packages/api/modules/shoots/procedures/toggle-calendar-sync.ts`, router update

---

- [ ] 10. Add calendar job enqueuing to assignment procedures

  **What to do**:
  - Modify `packages/api/modules/shoots/procedures/assign-crew.ts`:
    - After successful assignment, check if `shoot.calendarSyncEnabled`
    - If crew has Google connection, enqueue `create_event` job
    - If crew has no connection but has email, enqueue `send_ics` job
    - If crew has no email, skip silently
  - Modify `packages/api/modules/shoots/procedures/unassign-crew.ts`:
    - After successful unassignment, check if calendar event exists
    - If event exists, enqueue `delete_event` job

  **Must NOT do**:
  - Do NOT call Google API directly (always use background job)
  - Do NOT fail assignment if calendar enqueue fails (fire-and-forget)

  **Parallelizable**: NO (depends on 7, 9)

  **References**:
  - `packages/api/modules/shoots/procedures/assign-crew.ts:84-141` - current assignment flow
  - `packages/api/modules/shoots/procedures/unassign-crew.ts:61-85` - current unassignment flow
  - `packages/api/modules/whatsapp/procedures/send-text.ts:100-113` - outbox enqueue pattern

  **Acceptance Criteria**:
  - [ ] Assign crew to calendar-enabled shoot → job appears in `calendar_sync_jobs`
  - [ ] Assign crew without Google but with email → `send_ics` job enqueued
  - [ ] Unassign crew with existing event → `delete_event` job enqueued
  - [ ] Assignment API still returns fast (<500ms) regardless of calendar

  **Commit**: YES
  - Message: `feat(api): add calendar sync to crew assignment flow`
  - Files: `packages/api/modules/shoots/procedures/assign-crew.ts`, `packages/api/modules/shoots/procedures/unassign-crew.ts`

---

### Phase 5: Email Fallback

- [ ] 11. Implement .ics file generation

  **What to do**:
  - Create `packages/integrations/google-calendar/ics-generator.ts`:
    - `generateIcsEvent(shoot, crew)` - returns .ics file content string
    - Include: event title, start/end time, location, description, organizer
    - Use `ics` npm package or manual RFC 5545 format
  - Handle timezone (use shoot's org timezone or UTC fallback)

  **Must NOT do**:
  - Do NOT include sensitive booking financial data in .ics
  - Do NOT include other crew members' info in .ics

  **Parallelizable**: YES (with Task 13)

  **References**:
  - `packages/database/drizzle/schema/studio.ts:399-454` - shoot fields for event data
  - RFC 5545 iCalendar specification

  **Acceptance Criteria**:
  - [ ] `generateIcsEvent(shoot, crew)` returns valid .ics string
  - [ ] .ics file opens in calendar app (Apple Calendar, Outlook, Google)
  - [ ] Event has correct: title, date, time, location, description

  **Commit**: YES
  - Message: `feat(integrations): add ics file generator`
  - Files: `packages/integrations/google-calendar/ics-generator.ts`

---

- [ ] 12. Create .ics email template and send logic

  **What to do**:
  - Create email template in `packages/mail/templates/shoot-calendar-invite.tsx`:
    - Subject: "Calendar Invite: {shoot.name}"
    - Body: Shoot details, crew role, booking info
    - Attachment: .ics file
  - Add `sendShootCalendarInvite` function to mail package
  - Integrate with `send_ics` job processor in calendar worker

  **Must NOT do**:
  - Do NOT send email if crew has no email address
  - Do NOT include .ics as inline content (must be attachment)

  **Parallelizable**: NO (depends on 11)

  **References**:
  - `packages/mail/templates/` - existing email template patterns
  - `packages/mail/provider/` - email sending implementation

  **Acceptance Criteria**:
  - [ ] Email template renders correctly
  - [ ] Email arrives with .ics attachment
  - [ ] Clicking attachment adds event to recipient's calendar
  - [ ] `send_ics` job processor sends email successfully

  **Commit**: YES
  - Message: `feat(mail): add shoot calendar invite email template`
  - Files: `packages/mail/templates/shoot-calendar-invite.tsx`, `packages/mail/index.ts`

---

### Phase 6: UI

- [ ] 13. Create Settings > Integrations page

  **What to do**:
  - Create `apps/web/app/(saas)/app/[organizationSlug]/settings/integrations/page.tsx`
  - Add page to settings navigation
  - Create `GoogleCalendarCard` component:
    - Show connection status (connected/not connected)
    - "Connect Google Calendar" button → initiates OAuth
    - "Disconnect" button when connected
    - Show connected Google email
  - Handle OAuth callback redirect

  **Must NOT do**:
  - Do NOT show calendar selection UI
  - Do NOT show sync history on this page

  **Parallelizable**: YES (with Task 11)

  **References**:
  - `apps/web/app/(saas)/app/[organizationSlug]/settings/notifications/page.tsx` - settings page pattern
  - `apps/web/modules/saas/settings/components/ConnectedAccountsBlock.tsx` - connected accounts UI pattern

  **Acceptance Criteria**:
  - [ ] Navigate to Settings > Integrations → page loads
  - [ ] Click "Connect Google Calendar" → redirects to Google OAuth
  - [ ] After OAuth → returns to page showing "Connected as user@gmail.com"
  - [ ] Click "Disconnect" → connection removed, shows "Connect" button

  **Commit**: YES
  - Message: `feat(web): add integrations settings page with google calendar`
  - Files: `apps/web/app/(saas)/app/[organizationSlug]/settings/integrations/page.tsx`, navigation updates

---

- [ ] 14. Add calendar sync toggle to shoot detail page

  **What to do**:
  - Find shoot detail page component
  - Add "Calendar Sync" toggle switch in shoot header/settings area
  - Show toggle only if user has `shoot:update` permission
  - Show sync status indicator (synced/pending/error)
  - Show tooltip explaining feature when not connected

  **Must NOT do**:
  - Do NOT show toggle if no crew have Google connected
  - Do NOT block UI while syncing (show pending state)

  **Parallelizable**: NO (depends on 9, 13)

  **References**:
  - `apps/web/modules/saas/studio/` - studio module UI components
  - `packages/ui/src/components/switch.tsx` - toggle switch component

  **Acceptance Criteria**:
  - [ ] Shoot detail page shows "Calendar Sync" toggle
  - [ ] Toggle ON → API called → toggle shows enabled
  - [ ] Toggle OFF → API called → calendar events deleted (via background)
  - [ ] Non-admin users don't see toggle

  **Commit**: YES
  - Message: `feat(web): add calendar sync toggle to shoot detail`
  - Files: shoot detail component files

---

### Phase 7: Integration & Polish

- [ ] 15. Add calendar sync to shoot update flow

  **What to do**:
  - Modify shoot update procedure to detect changes to: `shootDate`, `startTime`, `endTime`, `venue`, `venueAddress`, `name`
  - If any synced field changes AND `calendarSyncEnabled` is true:
    - Fetch all `shoot_calendar_events` for this shoot
    - Enqueue `update_event` job for each
  - Update worker's `update-event` processor to handle partial updates

  **Must NOT do**:
  - Do NOT sync every shoot field change (only calendar-relevant fields)
  - Do NOT fail shoot update if calendar enqueue fails

  **Parallelizable**: NO (depends on 10)

  **References**:
  - Shoot update procedure (find in `packages/api/modules/shoots/procedures/`)
  - `packages/api/modules/shoots/procedures/assign-crew.ts:104-113` - safe side-effect pattern

  **Acceptance Criteria**:
  - [ ] Change shoot date → calendar events updated for all crew
  - [ ] Change venue → calendar events show new location
  - [ ] Change shoot name → calendar event title updated
  - [ ] Change notes only (non-calendar field) → no calendar update triggered

  **Commit**: YES
  - Message: `feat(api): sync shoot updates to google calendar`
  - Files: shoot update procedure

---

- [ ] 16. Handle Google Calendar disconnection cleanup

  **What to do**:
  - In disconnect procedure, BEFORE revoking token:
    - Find all `shoot_calendar_events` for this user
    - Enqueue `delete_event` jobs for each
    - Wait for jobs to process OR mark events as orphaned
  - Add `disconnectedAt` timestamp to connection record (soft delete)
  - Consider: Show warning about pending events before disconnect

  **Must NOT do**:
  - Do NOT hard-delete connection immediately (keep for audit)
  - Do NOT leave orphaned event records

  **Parallelizable**: NO (depends on 10)

  **References**:
  - `packages/api/modules/integrations/procedures/disconnect-google-calendar.ts` - disconnect procedure
  - Soft delete pattern in studio schema

  **Acceptance Criteria**:
  - [ ] Disconnect Google → all calendar events deleted from Google
  - [ ] `shoot_calendar_events` records cleaned up
  - [ ] `google_calendar_connections` has `disconnectedAt` set (not deleted)
  - [ ] Re-connecting creates new connection record

  **Commit**: YES
  - Message: `feat(api): handle calendar disconnection cleanup`
  - Files: disconnect procedure, connection schema

---

- [ ] 17. End-to-end manual QA

  **What to do**:
  - Complete manual QA checklist:
    1. Connect Google Calendar as crew member
    2. Admin creates shoot with calendar sync enabled
    3. Admin assigns connected crew → event appears in Google Calendar
    4. Admin assigns non-connected crew with email → .ics email received
    5. Admin updates shoot date → calendar event updated
    6. Admin unassigns crew → event removed from calendar
    7. Crew disconnects Google → all their events removed
    8. Admin disables calendar sync → all events removed
  - Document any bugs found
  - Verify error handling (expired tokens, API failures, etc.)

  **Must NOT do**:
  - Do NOT skip any QA step
  - Do NOT approve if any critical flow fails

  **Parallelizable**: NO (final task)

  **References**:
  - All previous tasks

  **Acceptance Criteria**:
  - [ ] All 8 QA scenarios pass
  - [ ] Error states handled gracefully (no crashes)
  - [ ] Performance acceptable (<2s for calendar operations)
  - [ ] Logs show proper audit trail

  **Commit**: NO (QA only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1-2 | `feat(database): add google calendar integration schema` | schema files | `pnpm db:generate` |
| 3-4 | `feat(integrations): add google calendar oauth` | oauth files | manual OAuth test |
| 5 | `feat(integrations): add google calendar service` | service files | manual API test |
| 6-7 | `feat(services): add calendar sync worker` | worker files | worker starts |
| 8 | `feat(api): add calendar connection procedures` | API files | curl tests |
| 9-10 | `feat(api): add calendar sync to assignments` | procedure files | job enqueue test |
| 11-12 | `feat(mail): add calendar invite email` | mail files | email test |
| 13-14 | `feat(web): add calendar integration UI` | web files | browser test |
| 15-16 | `feat(api): add calendar update and cleanup` | API files | integration test |

---

## Success Criteria

### Verification Commands
```bash
# Database schema applied
pnpm db:migrate

# Worker starts
pnpm --filter calendar-worker dev

# API responds
curl -X GET http://localhost:3000/api/integrations/google-calendar/status
```

### Final Checklist
- [ ] Crew can connect/disconnect Google Calendar
- [ ] Calendar events created on assignment
- [ ] Calendar events updated on shoot changes
- [ ] Calendar events deleted on unassignment
- [ ] .ics email sent to non-connected crew
- [ ] Background worker processes jobs with retry
- [ ] UI shows connection status and sync toggle
- [ ] All "Must NOT Have" guardrails respected
