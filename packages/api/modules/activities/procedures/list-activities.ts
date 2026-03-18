import { activities, and, db, desc, eq, inArray, sql } from "@repo/database";
import { z } from "zod";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { ACTION_TYPES, ENTITY_TYPES } from "../lib";

// Cursor format: {ISO_DATE}_{UUID}
// Example: 2025-01-13T10:30:00.000Z_abc123-def456
const CURSOR_REGEX =
	/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)_([a-z0-9-]+)$/i;

function parseCursor(cursor: string): { createdAt: Date; id: string } | null {
	const match = cursor.match(CURSOR_REGEX);
	if (!match) {
		return null;
	}
	const date = new Date(match[1]);
	if (Number.isNaN(date.getTime())) {
		return null;
	}
	return { createdAt: date, id: match[2] };
}

function encodeCursor(createdAt: Date, id: string): string {
	return `${createdAt.toISOString()}_${id}`;
}

// Type-safe enums for filtering
const entityTypeSchema = z.enum(ENTITY_TYPES);
const actionTypeSchema = z.enum(ACTION_TYPES);

const listActivitiesInputSchema = z.object({
	// Pagination
	limit: z.number().min(1).max(100).default(20),
	cursor: z.string().optional(), // Format: {createdAt}_{id} for compound cursor pagination

	// Filters - type-safe enums reject invalid values at runtime
	entityType: entityTypeSchema.optional(), // Single entity type
	entityTypes: z.array(entityTypeSchema).optional(), // Multiple entity types (OR)
	entityId: z.string().optional(),
	parentEntityType: entityTypeSchema.optional(),
	parentEntityId: z.string().optional(),
	actorId: z.string().optional(),
	action: actionTypeSchema.optional(),
});

const activityItemSchema = z.object({
	id: z.string(),
	actorId: z.string(),
	actorType: z.string(),
	actorName: z.string(),
	entityType: entityTypeSchema,
	entityId: z.string(),
	entityName: z.string(),
	parentEntityType: entityTypeSchema.nullable(),
	parentEntityId: z.string().nullable(),
	parentEntityName: z.string().nullable(),
	action: actionTypeSchema,
	field: z.string().nullable(),
	oldValue: z.string().nullable(),
	newValue: z.string().nullable(),
	metadata: z.unknown().nullable(),
	createdAt: z.date(),
});

const listActivitiesOutputSchema = z.object({
	data: z.array(activityItemSchema),
	nextCursor: z.string().nullable(),
});

export const listActivities = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/activities",
		tags: ["Activities"],
		summary: "List activities",
		description: "List recent activities for the organization",
	})
	.input(listActivitiesInputSchema)
	.output(listActivitiesOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "dashboard", "read");

		const {
			limit,
			cursor,
			entityType,
			entityTypes,
			entityId,
			parentEntityType,
			parentEntityId,
			actorId,
			action,
		} = input;

		// Build filter conditions
		const conditions = [
			eq(activities.organizationId, context.organizationId),
		];

		// Compound cursor for deterministic pagination
		if (cursor) {
			const parsed = parseCursor(cursor);
			if (parsed) {
				// WHERE (createdAt < cursorDate) OR (createdAt = cursorDate AND id < cursorId)
				conditions.push(
					sql`(${activities.createdAt} < ${parsed.createdAt} OR (${activities.createdAt} = ${parsed.createdAt} AND ${activities.id} < ${parsed.id}))`,
				);
			}
			// If cursor is invalid, skip it and start from beginning
		}

		// entityTypes takes precedence over entityType (array vs single)
		if (entityTypes && entityTypes.length > 0) {
			conditions.push(inArray(activities.entityType, entityTypes));
		} else if (entityType) {
			conditions.push(eq(activities.entityType, entityType));
		}

		if (entityId) {
			conditions.push(eq(activities.entityId, entityId));
		}

		if (parentEntityType) {
			conditions.push(eq(activities.parentEntityType, parentEntityType));
		}

		if (parentEntityId) {
			conditions.push(eq(activities.parentEntityId, parentEntityId));
		}

		if (actorId) {
			conditions.push(eq(activities.actorId, actorId));
		}

		if (action) {
			conditions.push(eq(activities.action, action));
		}

		// Query activities with compound ordering for deterministic pagination
		const results = await db.query.activities.findMany({
			where: and(...conditions),
			orderBy: [desc(activities.createdAt), desc(activities.id)],
			limit: limit + 1, // Fetch one extra to determine if there's a next page
		});

		// Determine if there's a next page
		const hasMore = results.length > limit;
		const items = hasMore ? results.slice(0, limit) : results;
		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem
				? encodeCursor(lastItem.createdAt, lastItem.id)
				: null;

		// Type assertions needed because DB returns strings, but Zod output
		// schema validates these are valid enum values before returning
		return {
			data: items.map((item) => ({
				id: item.id,
				actorId: item.actorId,
				actorType: item.actorType,
				actorName: item.actorName,
				entityType: item.entityType as z.infer<typeof entityTypeSchema>,
				entityId: item.entityId,
				entityName: item.entityName,
				parentEntityType: item.parentEntityType as z.infer<
					typeof entityTypeSchema
				> | null,
				parentEntityId: item.parentEntityId,
				parentEntityName: item.parentEntityName,
				action: item.action as z.infer<typeof actionTypeSchema>,
				field: item.field,
				oldValue: item.oldValue,
				newValue: item.newValue,
				metadata: item.metadata,
				createdAt: item.createdAt,
			})),
			nextCursor,
		};
	});
