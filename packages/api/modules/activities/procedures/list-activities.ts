import { activities, db, desc, eq, and, or, sql } from "@repo/database";
import { z } from "zod";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import type { EntityType, ActionType } from "../lib";

const listActivitiesInputSchema = z.object({
	// Pagination
	limit: z.number().min(1).max(100).default(20),
	cursor: z.string().optional(), // createdAt timestamp for cursor-based pagination

	// Filters
	entityType: z.string().optional(),
	entityId: z.string().optional(),
	parentEntityType: z.string().optional(),
	parentEntityId: z.string().optional(),
	actorId: z.string().optional(),
	action: z.string().optional(),
});

const activityItemSchema = z.object({
	id: z.string(),
	actorId: z.string(),
	actorType: z.string(),
	actorName: z.string(),
	entityType: z.string(),
	entityId: z.string(),
	entityName: z.string(),
	parentEntityType: z.string().nullable(),
	parentEntityId: z.string().nullable(),
	parentEntityName: z.string().nullable(),
	action: z.string(),
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
		const {
			limit,
			cursor,
			entityType,
			entityId,
			parentEntityType,
			parentEntityId,
			actorId,
			action,
		} = input;

		// Build filter conditions
		const conditions = [eq(activities.organizationId, context.organizationId)];

		if (cursor) {
			conditions.push(sql`${activities.createdAt} < ${new Date(cursor)}`);
		}

		if (entityType) {
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

		// Query activities
		const results = await db.query.activities.findMany({
			where: and(...conditions),
			orderBy: [desc(activities.createdAt)],
			limit: limit + 1, // Fetch one extra to determine if there's a next page
		});

		// Determine if there's a next page
		const hasMore = results.length > limit;
		const items = hasMore ? results.slice(0, limit) : results;
		const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : null;

		return {
			data: items.map((item) => ({
				id: item.id,
				actorId: item.actorId,
				actorType: item.actorType,
				actorName: item.actorName,
				entityType: item.entityType as EntityType,
				entityId: item.entityId,
				entityName: item.entityName,
				parentEntityType: item.parentEntityType as EntityType | null,
				parentEntityId: item.parentEntityId,
				parentEntityName: item.parentEntityName,
				action: item.action as ActionType,
				field: item.field,
				oldValue: item.oldValue,
				newValue: item.newValue,
				metadata: item.metadata,
				createdAt: item.createdAt,
			})),
			nextCursor,
		};
	});
