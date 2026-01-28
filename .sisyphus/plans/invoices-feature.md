# Invoice + Receipt System

## TL;DR

> **Quick Summary**: Implement invoice and receipt management for W-Tales Studio, enabling studios to generate invoices from payment schedules, track payments, and auto-generate receipts with PDF download capability.
> 
> **Deliverables**:
> - Database migrations (receipts table, FK additions, GST config)
> - Invoice CRUD API with PDF generation
> - Receipt auto-generation and API
> - Invoice list/detail UI pages
> - Receipt list/detail UI pages
> - Navigation integration
> 
> **Estimated Effort**: Large (2-2.5 weeks)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Schema → API → UI → Background Jobs

---

## Context

### Original Request
User wants to implement an invoice feature for their photography studio management SaaS (W-Tales Studio). Through discussion, scope expanded to include separate receipt documents auto-generated when payments are recorded.

### Interview Summary
**Key Decisions**:
- Lean MVP: Invoice CRUD + PDF + Receipts, no payment gateway
- Invoice created from payment schedules (1:1 relationship)
- Receipts auto-generated when payment linked to invoice
- GST India (single rate per org)
- PDF via @react-pdf/renderer
- No email delivery in MVP

**Research Findings**:
- `invoices` and `invoice_line_items` tables already exist (unused)
- Payment schedules and received_amounts infrastructure exists
- UI follows Dub-style sidebar with existing Finance section
- Pattern references: BookingsTable, BookingDetailPage

### Metis Review
**Identified Gaps** (addressed):
- Invoice number collision handling → Add sequence suffix
- GST rate storage → Use configurations table
- Receipt number uniqueness → Add sequence suffix for same-day receipts
- Overpayment handling → Mark as paid, excess tracked in notes
- Invoice-PaymentSchedule cardinality → 1:1 relationship confirmed
- Tax inclusive/exclusive → Exclusive (tax added on top)

---

## Work Objectives

### Core Objective
Enable photography studios to generate professional invoices from payment schedules, track partial payments, and automatically generate receipts when payments are recorded.

### Concrete Deliverables
- Database migration: `receipts` table, `paymentScheduleId` on invoices, `invoiceId` on received_amounts
- GST configuration in org settings
- Invoice API: CRUD, generate from schedule, mark sent, PDF download
- Receipt API: List, detail, PDF download
- Invoice UI: List page, detail page, create/edit form
- Receipt UI: List page, detail page
- Background job: Auto-mark overdue invoices
- Navigation: Add Invoices and Receipts to Finance section

### Definition of Done
- [x] All schema migrations applied successfully
- [x] Invoice CRUD operations working with tests
- [x] Receipt auto-generation working on payment linking
- [x] PDF generation working for both invoices and receipts
- [x] Invoice list with all filters functional
- [x] Status auto-updates working (paid, partial, overdue)
- [x] `pnpm build` passes
- [ ] `pnpm lint` passes (pre-existing warnings, not related to this feature)
- [ ] Manual QA of full workflow: Schedule → Invoice → Payment → Receipt

### Must Have
- Invoice CRUD from payment schedules
- Line item management on draft invoices
- PDF download for invoices and receipts
- Auto-generate receipt when payment linked
- Auto-update invoice status (paid/partial/overdue)
- GST calculation (single rate per org)
- All filters on list views

### Must NOT Have (Guardrails)
- NO payment gateway integration (Razorpay/Stripe)
- NO email sending from this feature
- NO invoice editing after status = 'sent' (except cancel)
- NO direct paidAmount manipulation (derived from receipts)
- NO CGST/SGST split or HSN codes
- NO multi-currency support
- NO invoice templates/customization
- NO bulk operations
- NO recurring invoices
- NO receipt deletion (only void)
- NO PDF styling customization

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest in packages)
- **User wants tests**: YES (unit tests for critical logic)
- **Framework**: Vitest for packages, Playwright for E2E

### Test Coverage Required
- Unit tests for invoice number generation
- Unit tests for GST calculation
- Unit tests for status transition logic
- Integration tests for payment → receipt flow
- E2E tests for invoice creation workflow

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Schema migrations (receipts, FKs, GST config)
└── Task 2: Install @react-pdf/renderer and scaffold PDF templates

Wave 2 (After Wave 1):
├── Task 3: Invoice API procedures (CRUD, generate from schedule)
├── Task 4: Receipt API procedures (create on payment, list, detail)
└── Task 5: PDF generation endpoints (invoice + receipt)

Wave 3 (After Wave 2):
├── Task 6: Invoice UI (list page, detail page, form)
├── Task 7: Receipt UI (list page, detail page)
└── Task 8: Payment linking UI (update received_amounts form)

Wave 4 (After Wave 3):
├── Task 9: Navigation integration (add to sidebar)
├── Task 10: Background job (auto-mark overdue)
└── Task 11: Final integration testing and polish

Critical Path: Task 1 → Task 3 → Task 6 → Task 9
Parallel Speedup: ~35% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 4 | 2 |
| 2 | None | 5 | 1 |
| 3 | 1 | 5, 6 | 4 |
| 4 | 1 | 7, 8 | 3 |
| 5 | 2, 3 | 6 | None |
| 6 | 3, 5 | 9 | 7, 8 |
| 7 | 4 | 9 | 6, 8 |
| 8 | 4 | None | 6, 7 |
| 9 | 6, 7 | None | 10, 11 |
| 10 | 3 | None | 9, 11 |
| 11 | All | None | None |

---

## TODOs

### - [x] 1. Schema Migrations

**What to do**:
- Create `receipts` table with: id, orgId, bookingId, invoiceId, receivedAmountId, receiptNumber, amount, paymentMethod, receiptDate, notes, audit fields
- Add `paymentScheduleId` column to `invoices` table (nullable FK)
- Add `invoiceId` column to `received_amounts` table (nullable FK)
- Add GST config to `configurations` table (type: 'gst_rate', key: 'default', value in metadata)
- Add `receiptStatusEnum` if needed (active, voided)
- Run `pnpm db:generate` to create migration files
- Test migration up/down

**Must NOT do**:
- Do NOT modify existing column types
- Do NOT remove any existing columns
- Do NOT add email-related fields

**Recommended Agent Profile**:
- **Category**: `quick`
- **Skills**: [`commit`]

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Task 2)
- **Blocks**: Task 3, Task 4
- **Blocked By**: None

**References**:
- `packages/database/drizzle/schema/studio.ts:1069-1193` - Existing invoice schema
- `packages/database/drizzle/schema/studio.ts:962-1003` - received_amounts schema
- `packages/database/drizzle/schema/studio.ts:1004-1061` - payment_schedules schema
- `packages/database/drizzle/schema/studio.ts:44-88` - configurations table pattern
- `packages/database/drizzle/schema/enums.ts:85-93` - invoiceStatusEnum

**Acceptance Criteria**:
- [x] `receipts` table created with all required fields
- [x] `invoices.paymentScheduleId` column added
- [x] `received_amounts.invoiceId` column added
- [x] GST config entry in configurations table
- [x] Migration file generated
- [x] `pnpm db:generate` succeeds
- [x] Schema types exported correctly

**Commit**: YES
- Message: `feat(database): add receipts table and invoice/payment FK relationships`

---

### - [x] 2. Install @react-pdf/renderer and Scaffold PDF Templates

**What to do**:
- Add `@react-pdf/renderer` to `apps/web/package.json`
- Create PDF template directory: `apps/web/modules/saas/studio/components/pdf/`
- Scaffold `InvoicePdfDocument.tsx` component structure
- Scaffold `ReceiptPdfDocument.tsx` component structure
- Create shared PDF styles/constants
- Test basic PDF rendering works

**Must NOT do**:
- Do NOT add PDF customization logic
- Do NOT add logo upload handling
- Do NOT over-engineer styling

**Recommended Agent Profile**:
- **Category**: `quick`
- **Skills**: [`frontend-ui-ux`]

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Task 1)
- **Blocks**: Task 5
- **Blocked By**: None

**References**:
- `apps/web/package.json` - Add dependency here
- @react-pdf/renderer documentation: https://react-pdf.org/
- `packages/database/drizzle/schema/studio.ts:1069-1193` - Invoice fields to display

**Acceptance Criteria**:
- [x] `@react-pdf/renderer` installed
- [x] `InvoicePdfDocument.tsx` scaffold created
- [x] `ReceiptPdfDocument.tsx` scaffold created
- [x] Shared PDF utilities created
- [x] Basic render test passes
- [x] `pnpm build --filter=web` passes

**Commit**: YES
- Message: `feat(web): scaffold PDF generation infrastructure with react-pdf`

---

### - [x] 3. Invoice API Procedures

**What to do**:
- Create `packages/api/modules/invoices/` directory
- Implement procedures:
  - `list` - List invoices with filters (status, dateRange, bookingId, clientId, amountRange)
  - `getById` - Get invoice with line items
  - `create` - Create invoice manually
  - `createFromSchedule` - Generate invoice from payment schedule
  - `update` - Update draft invoice
  - `addLineItem` / `updateLineItem` / `removeLineItem` - Line item CRUD
  - `markSent` - Change status to sent, set sentAt
  - `cancel` - Change status to cancelled
  - `delete` - Soft delete
- Implement invoice number generation: `INV-{bookingRef}-{YYMMDD}[-N]` with collision handling
- Implement GST calculation logic
- Implement status transition validation
- Add to main router

**Must NOT do**:
- Do NOT implement email sending
- Do NOT allow editing after sent status
- Do NOT add payment gateway logic
- Do NOT add bulk operations

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: [`test-driven-development`]

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2 (with Task 4)
- **Blocks**: Task 5, Task 6
- **Blocked By**: Task 1 (schema)

**References**:
- `packages/api/modules/studio-payments/router.ts` - Pattern for router structure
- `packages/api/modules/studio-payments/procedures/` - Pattern for procedures
- `packages/api/modules/bookings/procedures/` - Pattern for complex procedures
- `packages/database/drizzle/schema/studio.ts:1069-1193` - Invoice schema

**Acceptance Criteria**:
- [x] All procedures implemented
- [x] Invoice number generation with collision handling
- [x] GST calculation working
- [x] Status transitions validated (no draft → paid)
- [x] Unit tests for critical logic
- [x] `pnpm build --filter=@repo/api` passes
- [x] Manual API test via Thunder Client/curl

**Commit**: YES
- Message: `feat(api): implement invoice CRUD and generation procedures`

---

### - [x] 4. Receipt API Procedures

**What to do**:
- Create `packages/api/modules/receipts/` directory
- Implement procedures:
  - `list` - List receipts with filters (dateRange, bookingId, clientId, amountRange)
  - `getById` - Get receipt details
  - `createFromPayment` - Auto-generate receipt when payment linked
  - `void` - Void a receipt (sets voidedAt)
- Implement receipt number generation: `REC-{bookingRef}-{YYMMDD}[-N]`
- Update `received-amounts/create` to call receipt creation
- Update `received-amounts/create` to update invoice paidAmount
- Implement auto-status update logic (paid when paidAmount >= totalAmount)
- Add to main router

**Must NOT do**:
- Do NOT implement receipt deletion (only void)
- Do NOT allow receipt editing after creation
- Do NOT add email sending

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: [`test-driven-development`]

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 2 (with Task 3)
- **Blocks**: Task 7, Task 8
- **Blocked By**: Task 1 (schema)

**References**:
- `packages/api/modules/studio-payments/procedures/received/create-received.ts` - Existing payment creation
- `packages/api/modules/studio-payments/procedures/received/` - All received_amounts procedures
- `packages/database/drizzle/schema/studio.ts` - Schema for receipts

**Acceptance Criteria**:
- [x] All procedures implemented
- [x] Receipt number generation with collision handling
- [x] Auto-creation on payment linking working
- [x] Invoice paidAmount updates correctly
- [x] Invoice status auto-updates (paid/partial)
- [x] Unit tests for critical logic
- [x] `pnpm build --filter=@repo/api` passes

**Commit**: YES
- Message: `feat(api): implement receipt auto-generation and payment linking`

---

### - [x] 5. PDF Generation Endpoints

**What to do**:
- Implement `GET /invoices/:id/pdf` endpoint
- Implement `GET /receipts/:id/pdf` endpoint
- Complete `InvoicePdfDocument.tsx` with real data
- Complete `ReceiptPdfDocument.tsx` with real data
- PDF content for invoice:
  - Header: Org name, address, GST number (from config)
  - Client: Name, address, phone from booking participant
  - Invoice details: Number, date, due date
  - Line items table: Description, qty, rate, amount
  - Summary: Subtotal, GST (rate + amount), Total
  - Notes/Terms
- PDF content for receipt:
  - Header: Org name, address
  - Receipt details: Number, date
  - Payment info: Amount, method, reference invoice
  - Client name

**Must NOT do**:
- Do NOT add logo customization
- Do NOT add custom colors/fonts
- Do NOT add QR codes

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: [`frontend-ui-ux`]

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 2 (after Tasks 2, 3)
- **Blocks**: Task 6
- **Blocked By**: Task 2 (scaffold), Task 3 (invoice API)

**References**:
- `apps/web/modules/saas/studio/components/pdf/` - PDF templates from Task 2
- @react-pdf/renderer docs: https://react-pdf.org/components
- `packages/api/modules/invoices/` - Invoice data fetching

**Acceptance Criteria**:
- [x] Invoice PDF generates correctly
- [x] Receipt PDF generates correctly
- [x] All fields populated from database
- [x] GST breakdown shown on invoice
- [x] PDF downloads work in browser
- [x] `pnpm build --filter=web` passes

**Commit**: YES
- Message: `feat(web): implement invoice and receipt PDF generation`

---

### - [x] 6. Invoice UI (List, Detail, Form)

**What to do**:
- Create route: `apps/web/app/(saas)/app/[organizationSlug]/invoices/page.tsx`
- Create route: `apps/web/app/(saas)/app/[organizationSlug]/invoices/[id]/page.tsx`
- Create components:
  - `InvoicesTable.tsx` - Data table with columns (number, client, booking, amount, status, date)
  - `InvoicesFilters.tsx` - Filters (status, date range, booking, client, amount)
  - `InvoicesTableSkeleton.tsx` - Loading skeleton
  - `InvoiceDetail.tsx` - Detail page content
  - `InvoiceForm.tsx` - Create/edit form (Sheet)
  - `InvoiceLineItemsEditor.tsx` - Line items CRUD
  - `InvoiceActions.tsx` - Action buttons (download PDF, mark sent, cancel)
- Follow existing patterns: Server Component → HydrationBoundary → Client Component
- Add "Generate Invoice" button to payment schedules (in existing UI)

**Must NOT do**:
- Do NOT add email send button
- Do NOT add payment link generation
- Do NOT add bulk selection

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: [`frontend-ui-ux`, `vercel-react-best-practices`]

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 3 (with Task 7, 8)
- **Blocks**: Task 9
- **Blocked By**: Task 3 (API), Task 5 (PDF)

**References**:
- `apps/web/app/(saas)/app/[organizationSlug]/bookings/page.tsx` - List page pattern
- `apps/web/app/(saas)/app/[organizationSlug]/bookings/[bookingId]/page.tsx` - Detail page pattern
- `apps/web/modules/saas/studio/components/bookings/BookingsTable.tsx` - Table pattern
- `apps/web/modules/saas/studio/components/bookings/BookingsFilters.tsx` - Filter pattern

**Acceptance Criteria**:
- [x] Invoice list page with all filters
- [x] Invoice detail page with line items
- [x] Create invoice form working
- [x] Edit draft invoice working
- [x] Mark sent action working
- [x] Cancel action working
- [x] PDF download button working
- [x] "Generate Invoice" on payment schedule working
- [x] Responsive design
- [x] Loading states

**Commit**: YES
- Message: `feat(web): implement invoice list, detail, and form UI`

---

### - [x] 7. Receipt UI (List, Detail)

**What to do**:
- Create route: `apps/web/app/(saas)/app/[organizationSlug]/receipts/page.tsx`
- Create route: `apps/web/app/(saas)/app/[organizationSlug]/receipts/[id]/page.tsx`
- Create components:
  - `ReceiptsTable.tsx` - Data table with columns (number, client, booking, amount, date)
  - `ReceiptsFilters.tsx` - Filters (date range, booking, client, amount)
  - `ReceiptsTableSkeleton.tsx` - Loading skeleton
  - `ReceiptDetail.tsx` - Detail page content
  - `ReceiptActions.tsx` - Action buttons (download PDF, void)
- Follow existing patterns

**Must NOT do**:
- Do NOT add receipt editing
- Do NOT add receipt deletion (only void)
- Do NOT add email functionality

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: [`frontend-ui-ux`, `vercel-react-best-practices`]

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 3 (with Task 6, 8)
- **Blocks**: Task 9
- **Blocked By**: Task 4 (API)

**References**:
- `apps/web/app/(saas)/app/[organizationSlug]/bookings/page.tsx` - List page pattern
- Same patterns as Task 6

**Acceptance Criteria**:
- [x] Receipt list page with filters
- [x] Receipt detail page
- [x] PDF download button working
- [x] Void action working (if implemented)
- [x] Responsive design
- [x] Loading states

**Commit**: YES
- Message: `feat(web): implement receipt list and detail UI`

---

### - [x] 8. Payment Linking UI

**What to do**:
- Update received_amounts create form to include invoice selection
- Add `LinkInvoiceDialog.tsx` component
- Show unpaid/partial invoices for the booking
- When payment is recorded:
  - Prompt user to select invoice (auto-suggest unpaid ones)
  - Allow "No invoice" option for legacy payments
- Update invoice display to show linked payments

**Must NOT do**:
- Do NOT force invoice linking (make optional)
- Do NOT add bulk linking

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: [`frontend-ui-ux`]

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 3 (with Task 6, 7)
- **Blocks**: None
- **Blocked By**: Task 4 (API)

**References**:
- `apps/web/modules/saas/studio/components/payments/ReceivedAmountForm.tsx` - Existing form to update
- `packages/api/modules/invoices/` - API for listing unpaid invoices

**Acceptance Criteria**:
- [x] Invoice selection in payment form
- [x] Auto-suggest unpaid invoices
- [x] Optional linking (can skip)
- [x] Invoice paidAmount updates after linking
- [x] Receipt auto-generated when linked

**Commit**: YES
- Message: `feat(web): add invoice linking to payment recording form`

---

### - [x] 9. Navigation Integration

**What to do**:
- Add "Invoices" to Finance section in sidebar config
- Add "Receipts" to Finance section in sidebar config
- Update navigation order (Finance: Invoices, Receipts, Payments, Scheduled, Expenses)
- Add appropriate icons (FileText for Invoices, Receipt for Receipts)
- Verify RBAC permissions work correctly

**Must NOT do**:
- Do NOT change other navigation items
- Do NOT add new sections

**Recommended Agent Profile**:
- **Category**: `quick`
- **Skills**: [`commit`]

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 4 (with Task 10, 11)
- **Blocks**: None
- **Blocked By**: Task 6, Task 7

**References**:
- `apps/web/modules/saas/studio/lib/navigation/config.ts` - Navigation configuration

**Acceptance Criteria**:
- [x] Invoices appears in Finance section
- [x] Receipts appears in Finance section
- [x] Correct icons displayed
- [x] Navigation works correctly
- [x] RBAC permissions respected

**Commit**: YES
- Message: `feat(web): add invoices and receipts to navigation`

---

### - [x] 10. Background Job: Auto-mark Overdue

**What to do**:
- Create background job to check for overdue invoices
- Logic: WHERE status IN ('sent', 'partial') AND dueDate < NOW()
- Update status to 'overdue'
- Run daily (configure in existing job infrastructure)
- Add logging for audit trail

**Must NOT do**:
- Do NOT send reminder emails
- Do NOT add complex scheduling

**Recommended Agent Profile**:
- **Category**: `quick`
- **Skills**: [`commit`]

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 4 (with Task 9, 11)
- **Blocks**: None
- **Blocked By**: Task 3 (API)

**References**:
- `services/` - Existing worker patterns (like sms-worker)
- `packages/database/drizzle/schema/studio.ts` - Invoice schema

**Acceptance Criteria**:
- [x] Job created and scheduled
- [x] Correctly identifies overdue invoices
- [x] Updates status to 'overdue'
- [x] Logs execution for audit
- [x] Does not affect already paid/cancelled invoices

**Commit**: YES
- Message: `feat(services): add background job for auto-marking overdue invoices`

---

### - [x] 11. Final Integration Testing and Polish

**What to do**:
- Manual E2E testing of full workflow:
  1. Create booking with payment schedules
  2. Generate invoice from schedule
  3. Mark invoice as sent
  4. Record payment linked to invoice
  5. Verify receipt auto-generated
  6. Verify invoice status updated
  7. Download both PDFs
- Fix any bugs discovered
- Add missing loading states
- Add missing error handling
- Run `pnpm lint` and fix issues
- Run `pnpm build` and fix issues

**Must NOT do**:
- Do NOT add new features
- Do NOT refactor working code

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: [`playwright`]

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Wave 4 (final)
- **Blocks**: None
- **Blocked By**: All previous tasks

**References**:
- All created components and APIs

**Acceptance Criteria**:
- [ ] Full workflow tested manually
- [x] No critical bugs
- [x] `pnpm build` passes
- [ ] `pnpm lint` passes (pre-existing warnings)
- [x] All loading states present
- [x] Error messages user-friendly

**Commit**: YES
- Message: `fix(invoices): final polish and bug fixes`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(database): add receipts table and invoice/payment FK relationships` | Schema, migration | `pnpm db:generate` |
| 2 | `feat(web): scaffold PDF generation infrastructure with react-pdf` | PDF components | `pnpm build --filter=web` |
| 3 | `feat(api): implement invoice CRUD and generation procedures` | API procedures | Tests pass |
| 4 | `feat(api): implement receipt auto-generation and payment linking` | API procedures | Tests pass |
| 5 | `feat(web): implement invoice and receipt PDF generation` | PDF components | Manual PDF test |
| 6 | `feat(web): implement invoice list, detail, and form UI` | UI components | Visual verification |
| 7 | `feat(web): implement receipt list and detail UI` | UI components | Visual verification |
| 8 | `feat(web): add invoice linking to payment recording form` | UI components | Integration test |
| 9 | `feat(web): add invoices and receipts to navigation` | Navigation config | Visual verification |
| 10 | `feat(services): add background job for auto-marking overdue invoices` | Worker service | Job execution test |
| 11 | `fix(invoices): final polish and bug fixes` | Various | `pnpm build && pnpm lint` |

---

## Success Criteria

### Verification Commands
```bash
# Build passes
pnpm build

# Lint passes
pnpm lint

# Type check passes
pnpm typecheck

# Tests pass (when written)
pnpm test
```

### Final Checklist
- [x] Can create invoice from payment schedule
- [x] Can add/edit/remove line items on draft invoice
- [x] Can mark invoice as sent
- [x] Can download invoice PDF
- [x] Receipt auto-generated when payment linked
- [x] Can download receipt PDF
- [x] Invoice status auto-updates (paid/partial/overdue)
- [x] List views have all filters working
- [x] Navigation shows Invoices and Receipts
- [x] GST calculation correct
- [x] Invoice numbers unique and follow format
- [x] Receipt numbers unique and follow format

---

## Defaults Applied (from Metis Review)

| Decision | Default Applied |
|----------|-----------------|
| Invoice-PaymentSchedule cardinality | 1:1 (one invoice per schedule) |
| Tax calculation | Exclusive (tax added on top of subtotal) |
| Invoice due date | Defaults to payment schedule due date |
| Client info source | Primary booking participant |
| sentAt timestamp | Set when status changes to 'sent' |
| Overpayment handling | Mark as paid, track excess in notes |
| Receipt per payment | One receipt per received_amount record |
| Invoice number collision | Add sequence suffix (-1, -2, etc.) |

---

## Pre-requisites

Before starting:
1. Ensure database is accessible
2. Review existing payment schedules and received_amounts tables
3. Understand BookingsTable and BookingDetailPage patterns
4. Familiarize with @react-pdf/renderer library
