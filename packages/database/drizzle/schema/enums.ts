import { pgEnum } from "drizzle-orm/pg-core";

// ============================================================================
// SYSTEM-CRITICAL ENUMS (Cannot be customized by organization owners)
// These drive business logic, workflows, and financial calculations
// ============================================================================

// ----------------------------------------------------------------------------
// Booking & Project Lifecycle
// ----------------------------------------------------------------------------

/**
 * Booking phase - drives the entire booking lifecycle
 * Business logic depends on these phases for transitions and permissions
 */
export const bookingPhaseEnum = pgEnum("booking_phase", [
	"new",
	"preparation",
	"shooting",
	"delivery",
	"completed",
	"cancelled",
]);

// ----------------------------------------------------------------------------
// Workflow & Submissions
// ----------------------------------------------------------------------------

/**
 * Workflow status - drives the submission/review process for tasks and deliverables
 * System-defined workflow that cannot be customized
 */
export const workflowStatusEnum = pgEnum("workflow_status", [
	"not_started",
	"assigned",
	"in_progress",
	"blocked",
	"submitted",
	"in_review",
	"revision_requested",
	"ready",
	"approved",
]);

/**
 * Assignment progress - crew-owned state before submission/review begins.
 */
export const assignmentProgressStatusEnum = pgEnum(
	"assignment_progress_status",
	["assigned", "in_progress", "blocked"],
);

export const deliverableTrackingModeEnum = pgEnum("deliverable_tracking_mode", [
	"direct",
	"task_based",
]);

export const deliverableTaskLinkKindEnum = pgEnum(
	"deliverable_task_link_kind",
	["required", "optional", "reference"],
);

/**
 * Submission status - tracks individual submission states in review workflow
 */
export const submissionStatusEnum = pgEnum("submission_status", [
	"draft",
	"submitted",
	"in_review",
	"approved",
	"rejected",
	"revision_requested",
]);

// ----------------------------------------------------------------------------
// Financial
// ----------------------------------------------------------------------------

/**
 * Payment method - fixed set of payment types
 * Used for tracking how payments were received
 */
export const paymentMethodEnum = pgEnum("payment_method", [
	"cash",
	"upi",
	"bank_transfer",
	"cheque",
	"card",
	"other",
]);

/**
 * Payment schedule status - financial calculations depend on these
 * Drives payment tracking and overdue notifications
 */
export const paymentScheduleStatusEnum = pgEnum("payment_schedule_status", [
	"pending",
	"partial",
	"completed",
	"overdue",
	"cancelled",
]);

/**
 * Invoice status - financial reporting depends on these
 * Standard invoice lifecycle states
 */
export const invoiceStatusEnum = pgEnum("invoice_status", [
	"draft",
	"sent",
	"paid",
	"partial",
	"overdue",
	"cancelled",
]);

/**
 * Tax type - determines how GST is applied to an invoice
 * - exclusive: Tax added on top of line item totals (default)
 * - inclusive: Tax already included in prices
 * - no_gst: No tax applied
 */
export const taxTypeEnum = pgEnum("tax_type", [
	"exclusive",
	"inclusive",
	"no_gst",
]);

/**
 * Line item type - determines how an invoice line item behaves
 * - milestone: Lump-sum amount (no quantity/unit_price)
 * - item: Itemized with quantity × unit_price
 * - service: Itemized with quantity × unit_price
 * - expense: Lump-sum amount (no quantity/unit_price)
 */
export const lineItemTypeEnum = pgEnum("line_item_type", [
	"milestone",
	"item",
	"service",
	"expense",
]);

/**
 * Bill to - binary choice for expense billing
 * Determines who is responsible for an expense
 */
export const billToEnum = pgEnum("bill_to", ["studio", "client"]);

// ----------------------------------------------------------------------------
// Configuration Types
// ----------------------------------------------------------------------------

/**
 * Configuration types - defines what settings can be customized per organization
 * Each type allows organizations to define their own values (statuses, priorities, etc.)
 */
export const configTypeEnum = pgEnum("config_type", [
	"task_status",
	"task_priority",
	"deliverable_status",
	"deliverable_priority",
	"crew_status",
	"crew_role",
	"shoot_status",
	"booking_type",
	"package_type",
	"relation_type",
	"expense_category",
	"event_type",
	"gst_rate",
]);

// ----------------------------------------------------------------------------
// Messaging (WhatsApp Integration)
// ----------------------------------------------------------------------------

/**
 * Conversation status - tracks WhatsApp conversation state
 */
export const conversationStatusEnum = pgEnum("conversation_status", [
	"active",
	"archived",
	"blocked",
]);

/**
 * Participant type - identifies who is in a conversation
 */
export const participantTypeEnum = pgEnum("participant_type", [
	"crew",
	"client",
]);

/**
 * Message direction - inbound (received) or outbound (sent)
 */
export const messageDirectionEnum = pgEnum("message_direction", [
	"inbound",
	"outbound",
]);

/**
 * Message type - the type of content in a message
 */
export const messageTypeEnum = pgEnum("message_type", [
	"text",
	"image",
	"document",
	"audio",
	"video",
]);

/**
 * Message status - delivery status of outbound messages
 */
export const messageStatusEnum = pgEnum("message_status", [
	"sent",
	"delivered",
	"read",
	"failed",
]);

// ----------------------------------------------------------------------------
// SaaS Billing
// ----------------------------------------------------------------------------

/**
 * Purchase type - subscription or one-time payment
 * Used for SaaS subscription management
 * Note: Using "purchaseType" (camelCase) to preserve the existing database shape
 */
export const purchaseTypeEnum = pgEnum("purchaseType", [
	"SUBSCRIPTION",
	"ONE_TIME",
]);

// ----------------------------------------------------------------------------
// Discussions (Internal team collaboration)
// ----------------------------------------------------------------------------

/**
 * Discussion status - open or resolved
 * Tracks whether a discussion has been concluded with a resolution
 */
export const discussionStatusEnum = pgEnum("discussion_status", [
	"open",
	"resolved",
]);

// ----------------------------------------------------------------------------
// Checkins (Team standup/update routines)
// ----------------------------------------------------------------------------

/**
 * Checkin frequency - defines how often a checkin routine runs
 */
export const checkinFrequencyEnum = pgEnum("checkin_frequency", [
	"daily",
	"weekdays",
	"weekly",
]);

/**
 * Checkin scope - organization-wide or restricted to a team
 */
export const checkinScopeEnum = pgEnum("checkin_scope", [
	"organization",
	"team",
]);

// ----------------------------------------------------------------------------
// Calendar Sync (Google + iCalendar)
// ----------------------------------------------------------------------------

export const calendarJobStatusEnum = pgEnum("calendar_job_status", [
	"pending",
	"processing",
	"completed",
	"failed",
]);

export const calendarJobTypeEnum = pgEnum("calendar_job_type", [
	"google_create",
	"google_update",
	"google_delete",
	"ics_send_invite",
	"ics_send_update",
	"ics_send_cancel",
]);

export const calendarDeliveryMethodEnum = pgEnum("calendar_delivery_method", [
	"google",
	"ics",
	"unsendable",
]);

export const calendarEventSyncStatusEnum = pgEnum(
	"calendar_event_sync_status",
	["pending", "synced", "error", "deleted", "unsendable"],
);
