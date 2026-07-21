---
read_when:
  - Changing list-page or global search behavior
  - Adding searchable fields, related-record matching, or search indexes
  - Changing CRM search permissions
---

# CRM Search

## Search contract

Search is entity-specific and intended to find a known record from remembered context. List-page and global-search implementations share the same entity condition builders.

Structured ranges, dates, and statuses belong in filters. A whole-query monetary value can exact-match visible financial totals; partial or ranged monetary matching is not supported by free-text search.

## Version 1 field coverage

### Bookings

- Name
- Reference number
- Booking type
- Package type
- Participant/client name
- Exact package cost
- Exact total received
- Exact outstanding balance
- Exact received-payment amount when the user has `payment:list`

### Shoots

- Name
- Type
- Venue and venue address
- Parent booking name and reference
- Assigned crew name
- Parent booking client name when the user has `client:list`

### Deliverables

- Name and description
- Parent booking name and reference
- Assigned crew name
- Parent booking client name when the user has `client:list`
- Exact cost

## Security invariants

- Every outer query is organization-scoped and excludes soft-deleted rows.
- Every related-record subquery repeats organization and soft-delete conditions.
- Client-name matching on shoots and deliverables requires `client:list`.
- Individual received-payment matching requires `payment:list`.
- Related records use correlated `EXISTS` predicates to avoid duplicate list rows and incorrect pagination counts.
- User-entered `%`, `_`, and `\\` characters are treated literally.

## Deferred

- Amount/date range filters
- Match-reason labels
- Relevance ranking and typo tolerance
- PostgreSQL trigram indexes, pending production query-plan measurements
- External search services
