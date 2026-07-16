import { activities, db } from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Entity types that can be tracked in the activity system.
 * Corresponds to database tables in the studio domain.
 *
 * Note: ENTITY_TYPES array is the source of truth - EntityType is derived from it.
 */
export const ENTITY_TYPES = [
	"booking",
	"booking_participant",
	"booking_event",
	"shoot",
	"shoot_assignment",
	"task",
	"task_assignment",
	"deliverable",
	"deliverable_assignment",
	"submission",
	"crew",
	"received_amount",
	"receipt",
	"payment_schedule",
	"expense",
	"invoice",
	"client",
	"member",
	"configuration",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Action types for activity tracking.
 * Covers CRUD operations, status changes, assignments, and domain-specific actions.
 *
 * Note: ACTION_TYPES array is the source of truth - ActionType is derived from it.
 */
export const ACTION_TYPES = [
	// CRUD
	"created",
	"updated",
	"deleted",
	// Status changes
	"status_changed",
	"workflow_changed",
	// Assignments
	"assigned",
	"unassigned",
	"lead_changed",
	// Submissions
	"submitted",
	"approved",
	"rejected",
	"revision_requested",
	// Payments
	"payment_received",
	"linked_to_schedule",
	"unlinked_from_schedule",
	"marked_paid",
	"marked_partial",
	// Invoices
	"invoice_sent",
	"cancelled",
	// Participants
	"participant_added",
	"participant_removed",
	"role_changed",
	// Events
	"event_created",
	"event_updated",
	"event_deleted",
	// Files
	"file_uploaded",
	"feedback_added",
	// Crew
	"marked_available",
	"marked_unavailable",
	// Configuration
	"option_created",
	"option_updated",
	"default_changed",
	"option_deleted",
	// Members
	"member_added",
	"member_removed",
	// Conversions
	"converted_to_task",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/**
 * Actor types - who performed the action
 */
export type ActorType = "user" | "crew" | "system";

// ============================================================================
// ACTIVITY INPUT TYPES
// ============================================================================

/**
 * Base input for creating an activity
 */
export interface CreateActivityInput {
	organizationId: string;
	// Actor information
	actorId: string;
	actorType: ActorType;
	actorName: string;
	// Entity information
	entityType: EntityType;
	entityId: string;
	entityName: string;
	// Parent context (optional)
	parentEntityType?: EntityType;
	parentEntityId?: string;
	parentEntityName?: string;
	// Action
	action: ActionType;
	// Field changes (optional - for updates)
	field?: string;
	oldValue?: string;
	newValue?: string;
	oldIdentifier?: string;
	newIdentifier?: string;
	// Metadata (optional)
	metadata?: Record<string, unknown>;
	// Epoch for grouping related activities
	epoch?: number;
}

/**
 * Context passed from procedures - contains user and organization info
 */
export interface ActivityContext {
	organizationId: string;
	user: {
		id: string;
		name: string;
	};
}

/**
 * Simplified input for tracking activities from procedures
 */
export interface TrackActivityInput {
	entityType: EntityType;
	entityId: string;
	entityName: string;
	action: ActionType;
	// Optional parent context
	parentEntityType?: EntityType;
	parentEntityId?: string;
	parentEntityName?: string;
	// Optional field changes
	field?: string;
	oldValue?: string;
	newValue?: string;
	oldIdentifier?: string;
	newIdentifier?: string;
	// Optional metadata
	metadata?: Record<string, unknown>;
}

// ============================================================================
// ACTIVITY SERVICE
// ============================================================================

/**
 * Create a single activity record.
 * This is the low-level function that writes to the database.
 */
export async function createActivityWithExecutor(
	executor: typeof db | TransactionClient,
	input: CreateActivityInput,
): Promise<void> {
	await executor.insert(activities).values({
		organizationId: input.organizationId,
		actorId: input.actorId,
		actorType: input.actorType,
		actorName: input.actorName,
		entityType: input.entityType,
		entityId: input.entityId,
		entityName: input.entityName,
		parentEntityType: input.parentEntityType ?? null,
		parentEntityId: input.parentEntityId ?? null,
		parentEntityName: input.parentEntityName ?? null,
		action: input.action,
		field: input.field ?? null,
		oldValue: input.oldValue ?? null,
		newValue: input.newValue ?? null,
		oldIdentifier: input.oldIdentifier ?? null,
		newIdentifier: input.newIdentifier ?? null,
		metadata: input.metadata ?? null,
		epoch: input.epoch?.toString() ?? null,
	});
}

export async function createActivity(
	input: CreateActivityInput,
): Promise<void> {
	await createActivityWithExecutor(db, input);
}

/**
 * Track an activity from a procedure context.
 * Automatically extracts actor info from context.
 *
 * @example
 * ```ts
 * await trackActivity(context, {
 *   entityType: "booking",
 *   entityId: booking.id,
 *   entityName: booking.name,
 *   action: "created",
 * });
 * ```
 */
export async function trackActivity(
	context: ActivityContext,
	input: TrackActivityInput,
): Promise<void> {
	await trackActivityWithExecutor(db, context, input);
}

export async function trackActivityWithExecutor(
	executor: typeof db | TransactionClient,
	context: ActivityContext,
	input: TrackActivityInput,
): Promise<void> {
	await createActivityWithExecutor(executor, {
		organizationId: context.organizationId,
		actorId: context.user.id,
		actorType: "user",
		actorName: context.user.name || "Unknown User",
		...input,
	});
}

/**
 * Safe version of trackActivity that catches errors.
 * Use this instead of trackActivity(...).catch(console.error) for Vercel compatibility.
 *
 * On Vercel serverless, fire-and-forget promises may never complete after the response
 * is returned. This wrapper awaits the activity write while ensuring failures don't
 * break the main mutation.
 *
 * @example
 * ```ts
 * // After your core DB writes:
 * await safeTrackActivity(context, {
 *   entityType: "booking",
 *   entityId: booking.id,
 *   entityName: booking.name,
 *   action: "created",
 * });
 * ```
 */
export async function safeTrackActivity(
	context: ActivityContext,
	input: TrackActivityInput,
): Promise<void> {
	try {
		await trackActivity(context, input);
	} catch (e) {
		console.error("Activity tracking failed:", e);
	}
}

/**
 * Track multiple field changes for an entity update.
 * Creates one activity per changed field for granular tracking.
 *
 * @example
 * ```ts
 * await trackFieldChanges(context, {
 *   entityType: "booking",
 *   entityId: booking.id,
 *   entityName: booking.name,
 *   changes: [
 *     { field: "name", oldValue: "Old Name", newValue: "New Name" },
 *     { field: "packageCost", oldValue: "50000", newValue: "60000" },
 *   ],
 * });
 * ```
 */
export async function trackFieldChanges(
	context: ActivityContext,
	input: {
		entityType: EntityType;
		entityId: string;
		entityName: string;
		parentEntityType?: EntityType;
		parentEntityId?: string;
		parentEntityName?: string;
		changes: Array<{
			field: string;
			oldValue: string | null | undefined;
			newValue: string | null | undefined;
			oldIdentifier?: string;
			newIdentifier?: string;
		}>;
		metadata?: Record<string, unknown>;
	},
): Promise<void> {
	// Filter to only actual changes
	const actualChanges = input.changes.filter(
		(c) => c.oldValue !== c.newValue,
	);

	if (actualChanges.length === 0) {
		return; // No changes to track
	}

	// Use same epoch to group related changes
	const epoch = Date.now();

	// Create activities for each change
	await Promise.all(
		actualChanges.map((change) =>
			createActivity({
				organizationId: context.organizationId,
				actorId: context.user.id,
				actorType: "user",
				actorName: context.user.name || "Unknown User",
				entityType: input.entityType,
				entityId: input.entityId,
				entityName: input.entityName,
				parentEntityType: input.parentEntityType,
				parentEntityId: input.parentEntityId,
				parentEntityName: input.parentEntityName,
				action: "updated",
				field: change.field,
				oldValue: change.oldValue ?? undefined,
				newValue: change.newValue ?? undefined,
				oldIdentifier: change.oldIdentifier,
				newIdentifier: change.newIdentifier,
				metadata: input.metadata,
				epoch,
			}),
		),
	);
}

/**
 * Track a status change for an entity.
 * Special case of field change with action "status_changed".
 *
 * @example
 * ```ts
 * await trackStatusChange(context, {
 *   entityType: "booking",
 *   entityId: booking.id,
 *   entityName: booking.name,
 *   oldStatus: "new",
 *   newStatus: "preparation",
 * });
 * ```
 */
export async function trackStatusChange(
	context: ActivityContext,
	input: {
		entityType: EntityType;
		entityId: string;
		entityName: string;
		parentEntityType?: EntityType;
		parentEntityId?: string;
		parentEntityName?: string;
		oldStatus: string;
		newStatus: string;
		metadata?: Record<string, unknown>;
	},
): Promise<void> {
	if (input.oldStatus === input.newStatus) {
		return; // No change
	}

	await createActivity({
		organizationId: context.organizationId,
		actorId: context.user.id,
		actorType: "user",
		actorName: context.user.name || "Unknown User",
		entityType: input.entityType,
		entityId: input.entityId,
		entityName: input.entityName,
		parentEntityType: input.parentEntityType,
		parentEntityId: input.parentEntityId,
		parentEntityName: input.parentEntityName,
		action: "status_changed",
		field: "status",
		oldValue: input.oldStatus,
		newValue: input.newStatus,
		metadata: input.metadata,
	});
}

/**
 * Track assignment changes (assign/unassign crew to entities).
 *
 * @example
 * ```ts
 * await trackAssignment(context, {
 *   entityType: "shoot_assignment",
 *   entityId: assignment.id,
 *   entityName: `${crew.name} → ${shoot.name}`,
 *   action: "assigned",
 *   parentEntityType: "shoot",
 *   parentEntityId: shoot.id,
 *   parentEntityName: shoot.name,
 *   metadata: { crewId: crew.id, crewName: crew.name, role: assignment.role },
 * });
 * ```
 */
export async function trackAssignment(
	context: ActivityContext,
	input: {
		entityType: EntityType;
		entityId: string;
		entityName: string;
		action: "assigned" | "unassigned" | "lead_changed";
		parentEntityType: EntityType;
		parentEntityId: string;
		parentEntityName: string;
		metadata?: Record<string, unknown>;
	},
): Promise<void> {
	await createActivity({
		organizationId: context.organizationId,
		actorId: context.user.id,
		actorType: "user",
		actorName: context.user.name || "Unknown User",
		entityType: input.entityType,
		entityId: input.entityId,
		entityName: input.entityName,
		parentEntityType: input.parentEntityType,
		parentEntityId: input.parentEntityId,
		parentEntityName: input.parentEntityName,
		action: input.action,
		metadata: input.metadata,
	});
}

// ============================================================================
// SAFE WRAPPERS (for Vercel serverless compatibility)
// ============================================================================

/**
 * Safe version of trackFieldChanges that catches errors.
 * Use this instead of trackFieldChanges(...).catch(console.error) for Vercel compatibility.
 */
export async function safeTrackFieldChanges(
	context: ActivityContext,
	input: Parameters<typeof trackFieldChanges>[1],
): Promise<void> {
	try {
		await trackFieldChanges(context, input);
	} catch (e) {
		console.error("Activity tracking (field changes) failed:", e);
	}
}

/**
 * Safe version of trackStatusChange that catches errors.
 * Use this instead of trackStatusChange(...).catch(console.error) for Vercel compatibility.
 */
export async function safeTrackStatusChange(
	context: ActivityContext,
	input: Parameters<typeof trackStatusChange>[1],
): Promise<void> {
	try {
		await trackStatusChange(context, input);
	} catch (e) {
		console.error("Activity tracking (status change) failed:", e);
	}
}

/**
 * Safe version of trackAssignment that catches errors.
 * Use this instead of trackAssignment(...).catch(console.error) for Vercel compatibility.
 */
export async function safeTrackAssignment(
	context: ActivityContext,
	input: Parameters<typeof trackAssignment>[1],
): Promise<void> {
	try {
		await trackAssignment(context, input);
	} catch (e) {
		console.error("Activity tracking (assignment) failed:", e);
	}
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a monetary value for display in activity logs.
 */
export function formatAmount(amount: string | number): string {
	const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(num);
}

/**
 * Format a date for display in activity logs.
 */
export function formatDate(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/**
 * Safely compare values and return changes array for trackFieldChanges.
 * Handles undefined/null normalization.
 */
export function detectChanges<T extends Record<string, unknown>>(
	oldValues: T,
	newValues: Partial<T>,
	fieldsToTrack: (keyof T)[],
): Array<{ field: string; oldValue: string | null; newValue: string | null }> {
	const changes: Array<{
		field: string;
		oldValue: string | null;
		newValue: string | null;
	}> = [];

	for (const field of fieldsToTrack) {
		if (!(field in newValues)) {
			continue; // Field not being updated
		}

		const oldVal = oldValues[field];
		const newVal = newValues[field];

		// Normalize values for comparison
		const oldStr = oldVal == null ? null : String(oldVal);
		const newStr = newVal == null ? null : String(newVal);

		if (oldStr !== newStr) {
			changes.push({
				field: String(field),
				oldValue: oldStr,
				newValue: newStr,
			});
		}
	}

	return changes;
}
