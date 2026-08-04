# Quotation Domain Foundation

read_when:
- Working on quotations, quote acceptance/versioning, or quote-to-booking conversion.
- Changing booking creation inputs or booking provenance.

## Model

- `quotes`: immutable-numbered version lifecycle (`draft`, `sent`, `accepted`, `converted`, `declined`, `expired`, `superseded`), expiry, currency, terms, and lifecycle timestamps.
- `quote_participants`: tenant-scoped client roles plus quote-only side metadata.
- `quote_options`: canonical option totals and one schema-versioned booking blueprint.
- `quote_line_items`: option-owned commercial detail.
- `quote_acceptances`: one accepted option per quote plus immutable accepted-option snapshot.
- `bookings.source_quote_*`: durable, unique conversion provenance.

Quote number/version uniqueness and booking source uniqueness include soft-deleted rows. Audit identities cannot be reused, and deleting a converted booking does not permit reconversion.

## Booking Blueprint v1

`quoteDraftContentInputSchema` accepts caller-owned content only. Quote number,
version, lineage, status, and transition timestamps are server-owned Q2 fields.

`bookingBlueprintV1Schema` contains every existing direct-booking input except:

- participants, sourced once from `quote_participants`;
- package cost, sourced once from the accepted option total.

`assembleBookingInputFromBlueprintV1` produces the existing validated booking input. Unknown blueprint versions fail validation.

Booking events preserve client-facing commitments while shoots remain the operational schedule. Therefore:

- participant `side` remains quote evidence; booking materialization uses participant role;
- each fixed dated document event materializes as both booking event evidence and a scheduled shoot linked by `shoots.booking_event_id`, copying its event type, side, date, location, notes, and promised coverage notes;
- tentative events remain booking event evidence only and stay off the shoot calendar until the studio assigns a fixed date; no crew assignment is invented from free-text coverage;
- legacy and manually scheduled shoots may remain unlinked, and deleting an event clears the link without deleting operational shoot history;
- quote terms remain quotation evidence and are not overloaded into booking notes.

## Materialization

`materializeBooking` is the canonical transaction-accepting booking graph boundary. Direct booking creation calls it today. Atomic quote conversion must:

1. lock and validate the accepted quote/acceptance;
2. parse the persisted v1 blueprint and accepted snapshot;
3. assemble participants and accepted option total;
4. call `materializeBooking` in the same transaction with provenance;
5. transition the quote to `converted` in that transaction.

Database uniqueness on `bookings.source_quote_id` is the final conversion-cardinality guard. Idempotent retries query the booking by source quote ID. Stored blueprint provenance is derived from a parsed blueprint; callers cannot supply its version independently. The database also requires the option version column to equal the JSON envelope version.

Booking reference allocation takes a transaction-scoped PostgreSQL advisory lock keyed by organization and monthly prefix before reading the current maximum.

## Q2 API and Lifecycle

Organization-scoped oRPC routes are registered under `quotes`. List and detail
are read-only and never advance expiry; expiry is an explicit authorized command:

- `GET /quotes`, `GET /quotes/{id}`
- `POST /quotes`, `PUT /quotes/{id}`, `DELETE /quotes/{id}`
- `POST /quotes/{id}/send|revise|accept|decline|expire|convert`

Lifecycle: `draft -> sent -> accepted -> converted`, with terminal sent outcomes
`declined|expired`; revision atomically changes an immutable non-draft to
`superseded` while creating the sole next-version draft. Draft content is the
only editable content. Quote numbers, versions, lineage, lifecycle timestamps,
sort orders, itemized line amounts, and option totals are server-owned.

Quote numbering uses `document_sequences`, the organization timezone, and a
tenant/month scope with format `{STUDIO}-Q-{YYMM}-{XXXX}`. Acceptance stores the
selected persisted option as an immutable snapshot. Conversion locks the quote,
reads that snapshot, calls `materializeBooking` in the same transaction, and
returns the durable linked booking—including a soft-deleted booking—on every
retry.

Blueprint v1 excludes received-payment evidence. Payment schedules are optional,
but when supplied their order is server-derived and their decimal-safe aggregate
must equal the server-computed option total. Conversion requires `quote:convert`,
`booking:create`, and `payment:create`.

Quote detail is an internal operational document containing the booking blueprint.
It requires `quote:readOperational`, granted only to owner/admin. Managers receive
summary list access plus draft update/send/revise; they do not receive quote detail,
accept, decline, expire, or conversion authority.

Database correction `0052` treats acceptance as the immutable conversion source.
Acceptance identity, fields, and snapshot cannot change after insertion while
tenant hard deletion remains possible. A sourced booking cannot clear or alter
provenance or package cost; its provenance, blueprint version, and cost are
validated from the acceptance snapshot rather than mutable live option values.
Conversion takes conflicting locks on quote, acceptance, and option rows. Once
linked, quote identity, option commercial fields/blueprint, and all line-item
writes are also protected.
Deferred constraint triggers enforce option subtotal as the transaction-final line
sum, allowing normal option-first batch writes. Lineage requires the same tenant
and quote number with an exact previous version and rejects cycles. Direct client
hard deletion cannot cascade away quote-participant evidence.

## Q3 Internal Frontend

The app now exposes a permission-aware quotations list, server-saved draft editor,
and owner/admin operational detail. List filters (search, status, client), sorting,
and pagination are URL-backed and normalized before they reach the API. The
editor flow is Proposal -> Pricing -> Booking -> Operations -> Review. It captures
caller-owned commercial content, contract attachment metadata, events, shoots,
shoot and deliverable crew assignments, deliverables, and optional payment
schedules in booking blueprint v1. When schedules are present, the UI checks the
same integer-cent, per-line rounding total enforced by the server. Server
procedures remain responsible for quote identity, participant/option/item order,
itemized line amounts, subtotals, and totals. Drafts are saved to the server only;
discard returns to the last server state, `beforeunload` protects dirty work, and
the browser does not restore quotation content from local storage.

Owner/admin can inspect the operational blueprint and perform lifecycle commands.
Managers see summary rows and can Send a draft or Revise a non-draft from the
list. Although managers have `quote:update`, Q2 intentionally denies
`quote:readOperational`; therefore the frontend does not expose manager edit or
detail routes, operational blueprints, acceptance/decline/expiry/conversion, or
other privileged actions. This is a product boundary, not a missing permission
workaround. Owner/admin retain the full editor, detail, and lifecycle surface.

Lifecycle controls mirror Q2 command preconditions. A quote whose expiry is
already due cannot be sent or accepted; a due sent quote offers explicit expiry
plus commands Q2 still permits, such as revise or decline. Conversion does not
navigate to a soft-deleted linked booking: the UI reports that durable historical
result and explains that reconversion is blocked.

Public share links, PDF generation, email delivery, and signatures remain out of
scope. “Send” records the internal lifecycle transition only. A conversion retry
that returns a soft-deleted linked booking is shown honestly and is not navigated
to as an active booking.

PostgreSQL regression coverage proves concurrent quote-number allocation,
concurrent revision allocation, immutable sent content, tenant participant
validation, concurrent/idempotent conversion, complete booking graph creation,
and rollback of the quote plus booking graph after a late transition failure.
