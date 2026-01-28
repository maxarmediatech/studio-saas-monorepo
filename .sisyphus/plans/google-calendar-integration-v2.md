# Google Calendar Integration (Option B) + Crew Assignment (V2)

## Goal
When a crew member is assigned to a shoot, they receive a calendar entry:
- If the crew has a linked app user and has connected Google Calendar: create/update/delete an event in their **primary** Google Calendar.
- If the crew has **no** linked app user (`crews.userId` is null) but has an email: send an email with an **iCalendar (.ics) invite** (and updates/cancellation).

Calendar sync is **always on for a crew** once they connect Google Calendar.

## Key Decisions
- **Per-crew OAuth** (no org-level calendar).
- **One-way sync**: App -> Google Calendar / Email (.ics). No Google -> App sync; no push notifications/webhooks.
- **Async side-effects** via DB outbox + worker (pattern from WhatsApp outbox worker).
- **All-day events**:
  - Calendar entries are created as **all-day** on `shootDate`.
  - Google Calendar API uses `start.date` and `end.date` (end = next day; end date is exclusive).
  - iCalendar uses `DTSTART;VALUE=DATE` and `DTEND;VALUE=DATE` (end date is exclusive).
- **Timezone usage**:
  - Since events are all-day, timezone is not required for event start/end.
  - If we include any human-readable time (e.g., a "call time" from `shoots.startTime`) in the description, we format it using `users.timezone` (fallback to `organizations.timezone`).

## Existing Anchors in Repo
- Auth users have timezone: `packages/database/drizzle/schema/auth.ts` (`users.timezone`).
- Orgs have canonical timezone: `packages/database/drizzle/schema/core.ts` (`organizations.timezone`).
- Crew profiles can be linked to users: created automatically on org member creation in `packages/auth/auth.ts`.
- Shoot assignment procedures exist:
  - `packages/api/modules/shoots/procedures/assign-crew.ts`
  - `packages/api/modules/shoots/procedures/unassign-crew.ts`
- Proven outbox/worker pattern:
  - `services/whatsapp-worker/src/index.ts`

## Functional Acceptance Criteria (Pass/Fail)
1) Crew user connects Google Calendar -> connection stored, status endpoint returns `connected: true`.
2) Assign a connected crew user to a shoot -> a Google Calendar event appears in their primary calendar.
3) Update shoot date/location/title -> event updates for all assigned connected crews.
4) Unassign a connected crew user -> event is deleted from that crew user's calendar.
5) Assign a non-user crew with email -> email arrives with `.ics` invite that adds to recipient calendar.
6) Update shoot after emailing `.ics` -> recipient gets `.ics` update that updates the same event.
7) Unassign non-user crew after emailing `.ics` -> recipient gets `.ics` cancellation.
8) Assignment APIs remain fast: no direct Google API calls in request path.

## Implementation Phases

### Phase 1: Database Schema (Drizzle)
Add a new schema file: `packages/database/drizzle/schema/integrations-google-calendar.ts` (or `integrations.ts` if you expect more providers).

Tables:
1. `google_calendar_connections`
   - `organizationId`, `userId` (unique pair)
   - `googleAccountEmail` (optional, for display)
   - `accessToken`, `refreshToken`, `scope`, `accessTokenExpiresAt`
   - `connectedAt`, `disconnectedAt`
   - Storage note: encrypt token fields at rest (app-level encryption util).

2. `shoot_calendar_events`
   - `organizationId`, `shootId`, `crewId` (unique `(shootId, crewId)`)
   - `googleEventId`, `calendarId` (store `primary` or actual id)
   - `lastSyncedAt`, `syncStatus`, `lastError`
   - Optional: `iCalUid` (stable UID used for `.ics` updates/cancel).

3. `calendar_sync_jobs` (outbox)
   - `organizationId`
   - `status` (`pending` | `processing` | `completed` | `failed`)
   - `jobType` (`google_create` | `google_update` | `google_delete` | `ics_send_invite` | `ics_send_update` | `ics_send_cancel`)
   - `shootId`, `crewId`
   - `payload` (json/text)
   - `attempts`, `maxAttempts`, `nextAttemptAt`, `lockedAt`, `lastError`

### Phase 2: Google OAuth (calendar-specific)
Create a dedicated OAuth flow (do NOT expand login scopes):
- Start: returns Google consent URL.
- Callback: exchanges code -> tokens -> store in `google_calendar_connections`.
- Refresh: background-safe token refresh.
- Disconnect: revoke token + mark connection disconnected.

Docs:
- Scopes: https://developers.google.com/workspace/calendar/api/auth
- Create events: https://developers.google.com/workspace/calendar/api/guides/create-events

Env vars:
- Prefer separate vars to avoid coupling login + calendar: `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`.

### Phase 3: Google Calendar Service Wrapper
Add `packages/integrations/google-calendar/`:
- `token-manager.ts` get/refresh token from DB.
- `calendar-service.ts` create/update/delete event using `calendarId="primary"`.
- Return normalized results `{ googleEventId, htmlLink }`.

Dependency:
- Add `googleapis` to workspace.

### Phase 4: iCalendar (.ics) Generator + Mail Send
Generate `.ics` content in a shared utility:
- Create invite (METHOD:REQUEST)
- Update (same UID, bump SEQUENCE)
- Cancel (METHOD:CANCEL)

Email:
- Add template in `packages/mail/templates/` that attaches `.ics`.
- Ensure the attachment is recognized as calendar invite.

### Phase 5: Calendar Worker (Outbox Processor)
Create `services/calendar-worker/`:
- Poll `calendar_sync_jobs` (batch size <= 10)
- Retry with backoff
- Update `shoot_calendar_events` sync state

Idempotency rules:
- If `shoot_calendar_events` has `googleEventId`, treat `google_create` as update.
- Ensure unique `(shootId, crewId)` mapping.

### Phase 6: Wire Into Existing API Flows
Modify:
- `packages/api/modules/shoots/procedures/assign-crew.ts`
  - Always enqueue:
    - If crew has `userId` and connection exists -> `google_create`
    - Else if crew has `email` -> `ics_send_invite`
    - Else no-op
- `packages/api/modules/shoots/procedures/unassign-crew.ts`
  - Enqueue:
    - If mapping exists -> `google_delete`
    - Else if email invite was previously sent -> `ics_send_cancel`
- `packages/api/modules/shoots/procedures/update-shoot.ts`
  - If calendar-relevant fields changed -> for each assignment enqueue:
    - connected user -> `google_update`
    - non-user email -> `ics_send_update`

Add integrations API module:
- `packages/api/modules/integrations-google-calendar/` with:
  - `connect` (returns auth URL)
  - `callback`
  - `disconnect`
  - `status`

### Phase 7: UI
Add settings page:
- `apps/web/app/(saas)/app/[organizationSlug]/settings/integrations/page.tsx`
  - Connect/disconnect Google Calendar
  - Show connected email + last sync error if available

Add UX affordances:
- On crew list / crew detail: show “Calendar: Connected” vs “Invite by email”.

### Phase 8: Backfill (Always-on per crew)
When a crew user connects Google Calendar:
- Enqueue `google_create` for all *upcoming* assigned shoots.
When a crew disconnects:
- Stop future jobs; optionally enqueue deletes for upcoming events (define behavior).

## Test Plan
### Objective
Verify that assignment/update/unassignment reliably produces Google events for connected crews and `.ics` invites for non-user crews.

### Test Cases
1. Connect Google Calendar -> DB row exists; status returns connected.
2. Assign connected crew -> outbox job created; worker creates event; mapping stored.
3. Update shoot -> outbox update jobs created; worker updates event.
4. Unassign connected crew -> delete job created; worker deletes event; mapping removed/marked.
5. Assign non-user crew -> email with `.ics` invite delivered.
6. Update shoot -> `.ics` update delivered (same UID).
7. Unassign -> `.ics` cancel delivered.

### How to Execute
- Unit/integration tests: mock Google API client responses (no real Google calls).
- Manual QA: one real Google account to validate end-to-end.

## Open Edge Cases (Defined Defaults)
- If `users.timezone` is null: fallback to `organizations.timezone`.
- If token refresh fails (revoked): mark connection disconnected; jobs fail with clear error; UI shows reconnect.
- All-day event end date: `end.date = shootDate + 1 day` (exclusive).
- If `shoots.startTime` exists (internal field): does not affect event start/end; include as optional description text only.
