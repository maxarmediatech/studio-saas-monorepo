# Legacy Studio Feature Gap Audit

> **Repository:** `<legacy-source-app>`
> **Last Updated:** 2024-12-20
> **Status:** Early Beta / MVP (60-70% Production Ready)
> **Note:** Historical planning doc from the pre-Stuwiz product.

This document tracks missing, incomplete, and planned features from the legacy studio management product that preceded Stuwiz.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Incomplete Core Features](#1-incomplete-core-features)
3. [Critical Missing Business Features](#2-critical-missing-business-features)
4. [Missing SaaS Platform Features](#3-missing-saas-platform-features)
5. [Missing Administrative Features](#4-missing-administrative-features)
6. [Studio-Specific Missing Features](#5-studio-specific-missing-features)
7. [Workflow Automation](#6-workflow-automation)
8. [Mobile Application](#7-mobile-application)
9. [Integrations](#8-integrations)
10. [Technical Debt & Code Quality](#9-technical-debt--code-quality)
11. [Priority Roadmap](#10-priority-roadmap)
12. [Feature Specifications](#11-feature-specifications)

---

## Executive Summary

### Current State
- **Total Files:** 542 TypeScript/TSX files
- **Pages:** 32 routes
- **API Endpoints:** 65 endpoints
- **Database Tables:** 40+ tables
- **Test Coverage:** 0%

### What's Complete
- Authentication (email/password + Google OAuth)
- Multi-organization support with RBAC
- Booking, Client, Crew, Shoot, Task management
- Deliverable tracking with submissions/reviews
- Expense & Payment tracking (manual only)
- Basic Dashboard with KPIs
- File uploads (S3)
- Configuration management
- Landing page

### What's Missing
- **60+ features** identified across 8 categories
- Critical gaps in: Payment Processing, Invoicing, Client Portal, Notifications

---

## 1. Incomplete Core Features

These features have been started but are not fully implemented.

### 1.1 Messaging System
| Attribute | Details |
|-----------|---------|
| **Status** | UI Complete, Backend Missing |
| **Location** | `src/app/(dashboard)/messages/page.tsx` |
| **TODO** | Line 128: `// TODO: Implement message sending via Convex` |
| **Priority** | High |

**What Exists:**
- [x] InboxSidebar component
- [x] UnifiedConversationPanel component
- [x] Message display UI

**What's Missing:**
- [ ] Message sending via Convex
- [ ] Message persistence to backend
- [ ] Real-time message synchronization
- [ ] Read receipts
- [ ] Typing indicators
- [ ] Message history retrieval
- [ ] File/image attachments in messages
- [ ] Message search

---

### 1.2 Branding Settings
| Attribute | Details |
|-----------|---------|
| **Status** | UI Only, No Backend Logic |
| **Location** | `src/app/(dashboard)/settings/_components/branding-settings.tsx` |
| **TODO** | Line 56: `// TODO: Implement update logic` |
| **Priority** | Medium |

**What Exists:**
- [x] Form UI for logo upload
- [x] Color picker for brand colors
- [x] Watermark configuration UI

**What's Missing:**
- [ ] Backend API endpoint for saving branding settings
- [ ] Logo upload to S3 and URL persistence
- [ ] Watermark image upload and storage
- [ ] Apply watermark to deliverable photos
- [ ] Custom color scheme persistence
- [ ] Branding preview functionality
- [ ] Apply branding to invoices/contracts

---

### 1.3 Billing Settings
| Attribute | Details |
|-----------|---------|
| **Status** | Mock Data Only |
| **Location** | `src/app/(dashboard)/settings/_components/billing-settings.tsx` |
| **Priority** | Critical |

**What Exists:**
- [x] UI with hardcoded invoice data
- [x] Mock payment method display

**What's Missing:**
- [ ] Stripe/Razorpay integration
- [ ] Subscription plan management
- [ ] Usage metering and limits
- [ ] Payment method CRUD
- [ ] Billing address management
- [ ] Tax configuration
- [ ] Invoice history (real data)
- [ ] Plan upgrade/downgrade flows

---

### 1.4 Dashboard Analytics
| Attribute | Details |
|-----------|---------|
| **Status** | Basic Implementation |
| **Location** | `src/lib/db/queries/dashboard.ts` |
| **TODO** | Lines 340, 363: Logic verification needed |
| **Priority** | Medium |

**What Exists:**
- [x] Basic stats (bookings, revenue, etc.)
- [x] Recent activity display

**What's Missing:**
- [ ] Time-series revenue charts
- [ ] Trend analysis (MoM, YoY)
- [ ] Booking conversion funnel
- [ ] Client acquisition metrics
- [ ] Crew utilization rates
- [ ] Custom date range selection
- [ ] Comparison periods

---

## 2. Critical Missing Business Features

### 2.1 Client Gallery & Proofing Platform
| Attribute | Details |
|-----------|---------|
| **Status** | Not Implemented |
| **Priority** | **CRITICAL** - Core differentiator |
| **Estimated Effort** | 3-4 weeks |

**Description:**
Studios need to share photos with clients for review and selection. This is a major gap and industry-standard feature.

**Required Features:**
- [ ] Public gallery creation from deliverables
- [ ] Password-protected gallery access
- [ ] Unique shareable gallery links
- [ ] Photo proofing interface
  - [ ] Approve/reject individual photos
  - [ ] Favorite/star photos
  - [ ] Add comments to photos
- [ ] Before/after comparison viewer
- [ ] Download permissions management
  - [ ] Watermarked preview downloads
  - [ ] High-resolution final downloads
- [ ] Gallery expiration dates
- [ ] View analytics (which photos viewed, time spent)
- [ ] Batch photo selection
- [ ] Print shop integration (optional)
- [ ] Mobile-responsive gallery viewer

**Database Changes Required:**
```sql
-- New tables needed
CREATE TABLE galleries (
  id UUID PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id),
  name VARCHAR(255),
  password_hash VARCHAR(255),
  access_token VARCHAR(255) UNIQUE,
  expires_at TIMESTAMP,
  allow_downloads BOOLEAN,
  watermark_enabled BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE gallery_photos (
  id UUID PRIMARY KEY,
  gallery_id UUID REFERENCES galleries(id),
  file_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  status VARCHAR(50), -- pending, approved, rejected
  client_favorite BOOLEAN,
  view_count INTEGER,
  created_at TIMESTAMP
);

CREATE TABLE gallery_comments (
  id UUID PRIMARY KEY,
  gallery_photo_id UUID REFERENCES gallery_photos(id),
  comment TEXT,
  commenter_name VARCHAR(255),
  created_at TIMESTAMP
);
```

---

### 2.2 Invoicing System
| Attribute | Details |
|-----------|---------|
| **Status** | Database Tables Exist, No Implementation |
| **Priority** | **CRITICAL** |
| **Estimated Effort** | 2-3 weeks |

**Database Status:**
Tables exist: `invoices`, `invoice_line_items` (unused)

**Required Features:**
- [ ] Invoice generation from bookings
- [ ] Auto-increment invoice numbers (INV-2024-001)
- [ ] Invoice templates (customizable)
- [ ] Line item management
  - [ ] Package items
  - [ ] Custom items
  - [ ] Discounts
- [ ] Tax calculation
  - [ ] GST/VAT support
  - [ ] Multiple tax rates
  - [ ] Tax-inclusive/exclusive pricing
- [ ] Payment terms configuration
- [ ] Due date tracking
- [ ] Invoice status workflow (draft → sent → paid → overdue)
- [ ] PDF invoice generation
- [ ] Email invoice to client
- [ ] Payment link generation (Stripe/Razorpay)
- [ ] Partial payment tracking
- [ ] Payment reminders (automated)
- [ ] Invoice duplication
- [ ] Credit notes/refunds
- [ ] Multi-currency support

**API Endpoints Required:**
```
POST   /api/invoices                    # Create invoice
GET    /api/invoices                    # List invoices
GET    /api/invoices/:id                # Get invoice
PUT    /api/invoices/:id                # Update invoice
DELETE /api/invoices/:id                # Delete invoice
POST   /api/invoices/:id/send           # Send invoice email
POST   /api/invoices/:id/payment-link   # Generate payment link
GET    /api/invoices/:id/pdf            # Download PDF
POST   /api/invoices/:id/reminder       # Send payment reminder
POST   /api/invoices/from-booking/:id   # Create from booking
```

---

### 2.3 Contracts & E-Signatures
| Attribute | Details |
|-----------|---------|
| **Status** | Not Implemented |
| **Priority** | **HIGH** |
| **Estimated Effort** | 2-3 weeks |

**Description:**
Professional studios require contracts for every booking. E-signature capability is essential.

**Required Features:**
- [ ] Contract template builder
  - [ ] Rich text editor
  - [ ] Variable placeholders ({{client_name}}, {{booking_date}}, etc.)
  - [ ] Template versioning
- [ ] Contract generation from templates
- [ ] Variable auto-substitution
- [ ] E-signature integration
  - [ ] Option 1: DocuSign integration
  - [ ] Option 2: HelloSign integration
  - [ ] Option 3: Built-in signature capture
- [ ] Contract status tracking (draft → sent → viewed → signed)
- [ ] Signed contract PDF storage
- [ ] Contract expiration dates
- [ ] Counter-signature workflow
- [ ] Contract renewal reminders
- [ ] Audit trail (who signed, when, IP address)
- [ ] Multiple signers support
- [ ] Contract amendment workflow

**Database Changes Required:**
```sql
CREATE TABLE contract_templates (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255),
  content TEXT, -- Rich text/HTML
  variables JSONB, -- Available placeholders
  version INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE contracts (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES contract_templates(id),
  booking_id UUID REFERENCES bookings(id),
  client_id UUID REFERENCES clients(id),
  content TEXT, -- Rendered content
  status VARCHAR(50), -- draft, sent, viewed, signed, expired
  sent_at TIMESTAMP,
  viewed_at TIMESTAMP,
  signed_at TIMESTAMP,
  signature_data JSONB,
  signed_pdf_url VARCHAR(500),
  expires_at TIMESTAMP,
  created_at TIMESTAMP
);
```

---

### 2.4 Quoting/Estimates System
| Attribute | Details |
|-----------|---------|
| **Status** | Not Implemented |
| **Priority** | **HIGH** |
| **Estimated Effort** | 1-2 weeks |

**Required Features:**
- [ ] Quote creation interface
- [ ] Quote from package templates
- [ ] Custom line items
- [ ] Discount support
- [ ] Quote validity period
- [ ] Quote status tracking (draft → sent → accepted → rejected → expired)
- [ ] Quote versioning (v1, v2, etc.)
- [ ] Quote → Booking conversion (one-click)
- [ ] Quote PDF generation
- [ ] Email quote to client
- [ ] Client acceptance workflow
- [ ] Quote comparison for client
- [ ] Quote notes/terms

**Database Changes Required:**
```sql
CREATE TABLE quotes (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  client_id UUID REFERENCES clients(id),
  quote_number VARCHAR(50),
  status VARCHAR(50),
  version INTEGER,
  valid_until DATE,
  subtotal DECIMAL(10,2),
  discount DECIMAL(10,2),
  tax DECIMAL(10,2),
  total DECIMAL(10,2),
  notes TEXT,
  terms TEXT,
  accepted_at TIMESTAMP,
  converted_booking_id UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE quote_line_items (
  id UUID PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id),
  description VARCHAR(500),
  quantity INTEGER,
  unit_price DECIMAL(10,2),
  total DECIMAL(10,2),
  sort_order INTEGER
);
```

---

### 2.5 Interactive Calendar
| Attribute | Details |
|-----------|---------|
| **Status** | Date Fields Only, No Visual Calendar |
| **Priority** | **HIGH** |
| **Estimated Effort** | 2 weeks |

**Required Features:**
- [ ] Monthly/weekly/daily calendar views
- [ ] Booking visualization on calendar
- [ ] Shoot scheduling on calendar
- [ ] Crew availability overlay
- [ ] Color coding by booking type/status
- [ ] Drag-and-drop rescheduling
- [ ] Click to create new booking/shoot
- [ ] Resource/equipment calendar
- [ ] Venue availability blocking
- [ ] Calendar filtering (by crew, type, status)
- [ ] Google Calendar sync (two-way)
- [ ] iCal feed export
- [ ] Calendar invitations to crew/clients
- [ ] Time zone support
- [ ] Recurring events support
- [ ] Calendar print view

**Recommended Libraries:**
- FullCalendar (React)
- react-big-calendar
- @schedule-x/react

---

### 2.6 Payment Processing Integration
| Attribute | Details |
|-----------|---------|
| **Status** | Manual Tracking Only |
| **Priority** | **CRITICAL** |
| **Estimated Effort** | 2-3 weeks |

**Current State:**
Tables exist for `received_amounts` and `payment_schedules` but no actual payment processing.

**Required Features:**
- [ ] Stripe integration
  - [ ] Payment links
  - [ ] Checkout sessions
  - [ ] Webhook handling
  - [ ] Refunds
- [ ] Razorpay integration (for India)
  - [ ] Payment links
  - [ ] Subscriptions
  - [ ] Refunds
- [ ] Payment link generation
- [ ] QR code for payments
- [ ] Automatic payment collection (scheduled)
- [ ] Partial payments support
- [ ] Payment plans/EMI options
- [ ] Multi-currency support
- [ ] Currency conversion
- [ ] Payment reconciliation
- [ ] Failed payment handling
- [ ] Payment retry logic
- [ ] Receipt generation
- [ ] Payment notifications

**API Endpoints Required:**
```
POST /api/payments/create-link          # Create payment link
POST /api/payments/create-checkout      # Create checkout session
POST /api/webhooks/stripe               # Stripe webhook
POST /api/webhooks/razorpay             # Razorpay webhook
POST /api/payments/:id/refund           # Process refund
GET  /api/payments/:id/receipt          # Get receipt
```

---

## 3. Missing SaaS Platform Features

### 3.1 Notification System
| Attribute | Details |
|-----------|---------|
| **Status** | Database Table Exists, No Implementation |
| **Priority** | **HIGH** |
| **Estimated Effort** | 2 weeks |

**Database Status:**
`notifications` table exists but is unused.

**Required Notification Types:**

| Event | Email | In-App | Push | SMS |
|-------|-------|--------|------|-----|
| New booking created | ✓ | ✓ | ✓ | - |
| Booking status changed | ✓ | ✓ | - | - |
| Payment received | ✓ | ✓ | ✓ | ✓ |
| Payment overdue | ✓ | ✓ | - | ✓ |
| Shoot reminder (24h before) | ✓ | ✓ | ✓ | ✓ |
| Task assigned | ✓ | ✓ | ✓ | - |
| Task due soon | ✓ | ✓ | - | - |
| Deliverable uploaded | ✓ | ✓ | - | - |
| Deliverable approved/rejected | ✓ | ✓ | ✓ | - |
| New message received | - | ✓ | ✓ | - |
| Invitation received | ✓ | - | - | - |
| Contract signed | ✓ | ✓ | - | - |

**Required Features:**
- [ ] Email notifications with templates
- [ ] In-app notification center (bell icon)
- [ ] Notification preferences per user
- [ ] Notification scheduling
- [ ] Notification grouping/batching
- [ ] Mark as read/unread
- [ ] Push notifications (web + mobile)
- [ ] SMS notifications (via MSG91)
- [ ] Notification history

---

### 3.2 Email Templates System
| Attribute | Details |
|-----------|---------|
| **Status** | Auth Emails Only |
| **Priority** | **HIGH** |
| **Estimated Effort** | 1-2 weeks |

**Current Templates:**
- [x] Invitation email
- [x] Password reset email

**Missing Templates:**
- [ ] Booking confirmation
- [ ] Booking reminder
- [ ] Payment receipt
- [ ] Payment reminder (due soon)
- [ ] Payment overdue notice
- [ ] Invoice sent
- [ ] Quote sent
- [ ] Contract sent for signature
- [ ] Contract signed confirmation
- [ ] Deliverable ready for review
- [ ] Gallery ready notification
- [ ] Shoot reminder
- [ ] Task assignment
- [ ] Welcome email (new client)
- [ ] Thank you email (post-shoot)
- [ ] Review request email
- [ ] Follow-up sequence emails

**Features Required:**
- [ ] Email template editor (WYSIWYG)
- [ ] Variable placeholders
- [ ] Template preview
- [ ] Test email sending
- [ ] Email tracking (opens, clicks)
- [ ] Unsubscribe handling

---

### 3.3 Advanced Analytics & Reporting
| Attribute | Details |
|-----------|---------|
| **Status** | Basic Stats Only |
| **Priority** | **MEDIUM** |
| **Estimated Effort** | 2-3 weeks |

**Required Reports:**

| Report | Description |
|--------|-------------|
| Revenue Report | Monthly/quarterly/yearly revenue with trends |
| Revenue by Package | Which packages generate most revenue |
| Revenue by Client | Top clients by revenue |
| Booking Conversion | Lead → Quote → Booking conversion rates |
| Client Acquisition | New clients over time, source tracking |
| Crew Utilization | Shoot days, idle time, productivity |
| Project Profitability | Revenue vs expenses per booking |
| Payment Aging | Outstanding payments by age |
| Tax Report | GST/VAT collected, payable |
| Expense Report | Expenses by category, project |

**Features Required:**
- [ ] Custom date range selection
- [ ] Comparison periods (vs last month/year)
- [ ] Interactive charts (Recharts already available)
- [ ] Export to PDF
- [ ] Export to Excel/CSV
- [ ] Scheduled report emails
- [ ] Dashboard widgets customization
- [ ] KPI alerts (when metrics exceed thresholds)

---

### 3.4 Audit Logging & Activity Tracking
| Attribute | Details |
|-----------|---------|
| **Status** | Partial (table exists) |
| **Priority** | **MEDIUM** |
| **Estimated Effort** | 1 week |

**Required Features:**
- [ ] Log all CRUD operations
- [ ] User action tracking (who did what, when)
- [ ] Login/logout logging
- [ ] Failed login attempts
- [ ] Data access logging
- [ ] Activity feed UI
- [ ] Filter by user, action, entity
- [ ] Export audit logs
- [ ] Retention policy configuration

---

## 4. Missing Administrative Features

### 4.1 Security Features
| Feature | Status | Priority |
|---------|--------|----------|
| Two-factor authentication (2FA) | Not Implemented | High |
| Login history | Not Implemented | Medium |
| Session management (active sessions) | Not Implemented | Medium |
| Device management | Not Implemented | Low |
| IP whitelisting | Not Implemented | Low |
| Password policies (strength, expiry) | Not Implemented | Medium |
| API rate limiting | Not Implemented | **Critical** |
| Brute force protection | Not Implemented | High |

### 4.2 Data Management
| Feature | Status | Priority |
|---------|--------|----------|
| Data export (all my data) | Not Implemented | High |
| GDPR data deletion requests | Not Implemented | High |
| Backup/restore | Not Implemented | Medium |
| Duplicate client merging | Not Implemented | Low |
| Data retention policies | Not Implemented | Medium |
| Import from other systems | Not Implemented | Low |

### 4.3 Organization Management
| Feature | Status | Priority |
|---------|--------|----------|
| Organization settings | Implemented | - |
| Multi-location support | Not Implemented | Medium |
| Branch management | Not Implemented | Low |
| Location-specific settings | Not Implemented | Low |
| Inter-location transfers | Not Implemented | Low |

---

## 5. Studio-Specific Missing Features

### 5.1 Equipment Management
| Attribute | Details |
|-----------|---------|
| **Status** | Not Implemented |
| **Priority** | **MEDIUM** |
| **Estimated Effort** | 1-2 weeks |

**Required Features:**
- [ ] Equipment inventory database
- [ ] Equipment categories (cameras, lenses, lighting, etc.)
- [ ] Equipment details (serial number, purchase date, value)
- [ ] Equipment assignment to shoots
- [ ] Equipment availability calendar
- [ ] Maintenance scheduling
- [ ] Maintenance history
- [ ] Equipment rental tracking
- [ ] Equipment depreciation
- [ ] Equipment insurance tracking
- [ ] Low stock alerts (consumables)

**Database Changes Required:**
```sql
CREATE TABLE equipment (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255),
  category VARCHAR(100),
  serial_number VARCHAR(100),
  purchase_date DATE,
  purchase_price DECIMAL(10,2),
  current_value DECIMAL(10,2),
  status VARCHAR(50), -- available, in-use, maintenance, retired
  notes TEXT,
  created_at TIMESTAMP
);

CREATE TABLE equipment_assignments (
  id UUID PRIMARY KEY,
  equipment_id UUID REFERENCES equipment(id),
  shoot_id UUID REFERENCES shoots(id),
  assigned_to UUID REFERENCES crews(id),
  assigned_at TIMESTAMP,
  returned_at TIMESTAMP,
  condition_notes TEXT
);

CREATE TABLE equipment_maintenance (
  id UUID PRIMARY KEY,
  equipment_id UUID REFERENCES equipment(id),
  type VARCHAR(100),
  description TEXT,
  cost DECIMAL(10,2),
  performed_at DATE,
  next_due DATE
);
```

---

### 5.2 Advanced Crew Features
| Feature | Status | Priority |
|---------|--------|----------|
| Crew profiles | ✅ Implemented | - |
| Skill tracking | ✅ Implemented | - |
| Availability management | ✅ Implemented | - |
| Performance reviews | Not Implemented | Medium |
| Portfolio/sample work | Not Implemented | Low |
| Payroll tracking | Not Implemented | Medium |
| Commission calculation | Not Implemented | Medium |
| Freelancer contracts | Not Implemented | Medium |
| Crew ratings by clients | Not Implemented | Low |
| Training/certification tracking | Not Implemented | Low |

### 5.3 Client Relationship Management (CRM)
| Feature | Status | Priority |
|---------|--------|----------|
| Client contact info | ✅ Implemented | - |
| Booking history | ✅ Implemented | - |
| Communication history | Not Implemented | High |
| Client preferences/notes | Not Implemented | Medium |
| Client reviews/testimonials | Not Implemented | Medium |
| Referral tracking | Not Implemented | Medium |
| Client lifetime value | Not Implemented | Low |
| Client segmentation | Not Implemented | Low |
| Birthday/anniversary reminders | Not Implemented | Low |
| Client tags/labels | Not Implemented | Low |

---

## 6. Workflow Automation

| Attribute | Details |
|-----------|---------|
| **Status** | Not Implemented |
| **Priority** | **HIGH** |
| **Estimated Effort** | 3-4 weeks |

**Description:**
Automation reduces manual work and ensures consistency. This is a major gap.

### Required Automation Features:

**Trigger-Based Automations:**
- [ ] When booking created → Create default tasks
- [ ] When booking status changes → Send notification
- [ ] When payment received → Send receipt, update booking
- [ ] When payment overdue → Send reminder (Day 1, 3, 7)
- [ ] When shoot date approaches → Send reminder (24h before)
- [ ] When deliverable uploaded → Notify client
- [ ] When contract signed → Update booking status

**Scheduled Automations:**
- [ ] Daily: Check for overdue payments
- [ ] Daily: Send shoot reminders
- [ ] Weekly: Send pending task digest
- [ ] Monthly: Generate revenue report

**Custom Automation Builder:**
- [ ] Trigger selection (event-based, time-based)
- [ ] Condition builder (if/then logic)
- [ ] Action selection (email, notification, status change)
- [ ] Delay support (wait X days)
- [ ] Automation logs

---

## 7. Mobile Application

| Attribute | Details |
|-----------|---------|
| **Status** | Planned Only |
| **Location** | `/todo/mobile-app-plan.md` |
| **Priority** | **MEDIUM** |
| **Estimated Effort** | 8-12 weeks |

**Required Features:**

**For Photographers (Crew):**
- [ ] View assigned shoots
- [ ] Check-in/check-out at location
- [ ] Upload photos from location
- [ ] View task list
- [ ] Mark tasks complete
- [ ] View booking details
- [ ] GPS navigation to venue
- [ ] Offline mode with sync

**For Managers:**
- [ ] Dashboard overview
- [ ] Approve/reject submissions
- [ ] Quick booking creation
- [ ] Payment tracking
- [ ] Crew location tracking (optional)
- [ ] Push notifications

**Technical Requirements:**
- [ ] React Native or Expo
- [ ] Offline-first architecture
- [ ] Background sync
- [ ] Push notification integration
- [ ] Camera integration
- [ ] Location services

---

## 8. Integrations

### Current Integrations
| Service | Status | Notes |
|---------|--------|-------|
| PostgreSQL | ✅ Active | Railway hosted |
| AWS S3 | ✅ Active | File storage |
| Resend | ✅ Active | Auth emails only |
| Google OAuth | ✅ Active | Authentication |
| Twilio WhatsApp | ⚠️ Partial | Webhook exists |
| Convex | ⚠️ Partial | Messaging only |
| Sentry | ✅ Active | Error tracking |

### Missing Integrations

| Integration | Priority | Use Case |
|-------------|----------|----------|
| **Stripe** | Critical | Payment processing |
| **Razorpay** | Critical | Payment processing (India) |
| **Google Calendar** | High | Two-way calendar sync |
| **Slack** | Medium | Team notifications |
| **Zapier** | Medium | Connect to 5000+ apps |
| **QuickBooks** | Medium | Accounting sync |
| **Xero** | Medium | Accounting sync |
| **Dropbox** | Low | File storage alternative |
| **Google Drive** | Low | File storage alternative |
| **DocuSign** | Medium | E-signatures |
| **HelloSign** | Medium | E-signatures |
| **Mailchimp** | Low | Marketing emails |
| **Zoom** | Low | Virtual consultations |

---

## 9. Technical Debt & Code Quality

### Critical Issues (from CODE_REVIEW.md)

| Issue | Severity | Location |
|-------|----------|----------|
| No API rate limiting | Critical | All API routes |
| Open redirect vulnerability | Critical | Login/signup |
| Missing authorization checks | High | Some API routes |
| Insufficient input validation | High | API routes |
| TypeScript errors ignored in build | High | `next.config.ts` |
| ESLint errors ignored in build | Medium | `next.config.ts` |

### Code Quality Issues

| Issue | Count | Action Required |
|-------|-------|-----------------|
| `console.log` statements | 46 | Remove before production |
| Disabled UI elements | 129 | Enable or remove |
| `as any` type coercion | Multiple | Fix type safety |
| Duplicate table components | Multiple | Consolidate |
| Missing error handling | Multiple | Add try/catch |

### Testing Gap

| Test Type | Current | Target |
|-----------|---------|--------|
| Unit tests | 0 | 80%+ coverage |
| Integration tests | 0 | Critical paths |
| E2E tests | 0 | Happy paths |
| API tests | 0 | All endpoints |

---

## 10. Priority Roadmap

### Phase 1: Critical (Weeks 1-6)
> Focus: Payment & Financial Foundation

- [ ] **Payment Processing** (Stripe/Razorpay)
- [ ] **Invoicing System**
- [ ] **Notification System** (Email + In-App)
- [ ] **Interactive Calendar**
- [ ] **API Rate Limiting**
- [ ] **Security Fixes**

### Phase 2: Essential (Weeks 7-14)
> Focus: Client-Facing Features

- [ ] **Client Gallery/Proofing Platform**
- [ ] **Contracts & E-Signatures**
- [ ] **Complete Messaging System**
- [ ] **Email Templates** (all transactional)
- [ ] **Quoting System**

### Phase 3: Competitive (Weeks 15-20)
> Focus: Efficiency & Intelligence

- [ ] **Workflow Automation**
- [ ] **Advanced Analytics**
- [ ] **2FA & Security Features**
- [ ] **Equipment Management**
- [ ] **CRM Enhancements**

### Phase 4: Differentiation (Weeks 21-32)
> Focus: Scale & Mobile

- [ ] **Mobile Application**
- [ ] **Google Calendar Integration**
- [ ] **Zapier Integration**
- [ ] **Multi-location Support**
- [ ] **Accounting Integrations**

### Phase 5: Polish (Ongoing)
> Focus: Quality & Testing

- [ ] **Unit Test Coverage (80%+)**
- [ ] **E2E Test Coverage**
- [ ] **Performance Optimization**
- [ ] **Documentation**
- [ ] **Remove Technical Debt**

---

## 11. Feature Specifications

Detailed specifications for each feature will be added as separate documents:

| Feature | Specification Document | Status |
|---------|----------------------|--------|
| Client Gallery | `docs/specs/CLIENT_GALLERY.md` | Not Created |
| Invoicing | `docs/specs/INVOICING.md` | Not Created |
| Contracts | `docs/specs/CONTRACTS.md` | Not Created |
| Notifications | `docs/specs/NOTIFICATIONS.md` | Not Created |
| Calendar | `docs/specs/CALENDAR.md` | Not Created |
| Payments | `docs/specs/PAYMENTS.md` | Not Created |
| Automation | `docs/specs/AUTOMATION.md` | Not Created |
| Mobile App | `docs/specs/MOBILE_APP.md` | Not Created |

---

## Tracking Progress

### Feature Completion Status

| Category | Total Features | Completed | In Progress | Not Started |
|----------|----------------|-----------|-------------|-------------|
| Core Features | 4 | 0 | 4 | 0 |
| Business Features | 6 | 0 | 0 | 6 |
| SaaS Features | 4 | 0 | 0 | 4 |
| Admin Features | 3 | 0 | 0 | 3 |
| Studio Features | 3 | 1 | 0 | 2 |
| Automation | 1 | 0 | 0 | 1 |
| Mobile | 1 | 0 | 0 | 1 |
| Integrations | 10 | 3 | 1 | 6 |
| **Total** | **32** | **4** | **5** | **23** |

---

## Changelog

| Date | Change |
|------|--------|
| 2024-12-20 | Initial document created |

---

## Contributing

When adding a new feature:
1. Check this document for requirements
2. Create detailed spec in `docs/specs/`
3. Update status in this document
4. Add database migrations if needed
5. Update API documentation
6. Add tests

---

*This document is maintained as the single source of truth for legacy feature planning.*
