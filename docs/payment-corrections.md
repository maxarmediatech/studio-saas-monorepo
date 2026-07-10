# Payment corrections

> **Read when:** changing received-payment editing, receipts, invoice payment totals, payment schedules, or financial-history views.

Finalized payments are corrected through reversal and replacement. They are not rewritten in place.

## Product behavior

- Notes and transaction references remain directly editable.
- A protected payment exposes **Correct payment** for amount, method, or date mistakes.
- A correction requires a reason.
- The original payment is marked reversed and removed from operational totals.
- Its active receipt is voided and preserved with the correction reason.
- A replacement payment is created with the same booking, invoice, and schedule links.
- If the original had a receipt, the replacement receives a new receipt number.
- Booking, invoice, and schedule totals are reversed and reapplied in one database transaction.
- Retrying the same correction request returns the first replacement instead of creating another.
- Replacement details show the previous amount, reason, reversal time, and voided receipt number.

## Invariants

- One payment can replace at most one prior payment.
- One reversed payment can point to at most one replacement.
- Reversed payments and voided receipts remain queryable for audit history.
- A failed replacement rolls back the reversal, receipt void, and all aggregate changes.
- Booking, invoice, and schedule relationships cannot be changed during correction.
