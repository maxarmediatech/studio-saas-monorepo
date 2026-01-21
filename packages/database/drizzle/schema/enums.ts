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
	"submitted",
	"in_review",
	"revision_requested",
	"approved",
]);

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
// SaaS Billing (from NebulaForge)
// ----------------------------------------------------------------------------

/**
 * Purchase type - subscription or one-time payment
 * Used for SaaS subscription management
 * Note: Using "purchaseType" (camelCase) to match existing NebulaForge schema
 */
export const purchaseTypeEnum = pgEnum("purchaseType", [
	"SUBSCRIPTION",
	"ONE_TIME",
]);

// ----------------------------------------------------------------------------
// Discussions (Internal team collaboration)
// ----------------------------------------------------------------------------

/**
 * Channel visibility - public or private
 * Public channels are visible to all org members
 * Private channels require explicit membership
 */
export const channelVisibilityEnum = pgEnum("channel_visibility", [
	"public",
	"private",
]);

/**
 * Discussion status - open or resolved
 * Tracks whether a discussion has been concluded with a resolution
 */
export const discussionStatusEnum = pgEnum("discussion_status", [
	"open",
	"resolved",
]);
