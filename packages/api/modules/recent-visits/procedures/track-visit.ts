import { db, sql } from "@repo/database";
import { nanoid } from "nanoid";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { verifyEntityExists } from "../lib/verify-entity";
import { trackVisitInputSchema, trackVisitOutputSchema } from "../schemas";

export const trackVisit = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/recent-visits/track",
		tags: ["Recent Visits"],
		summary: "Track entity visit",
		description:
			"Record that a user visited an entity for recent items list",
	})
	.input(trackVisitInputSchema)
	.output(trackVisitOutputSchema)
	.handler(async ({ input, context }) => {
		const { entityType, entityId } = input;
		const { organizationId, user } = context;
		const userId = user.id;

		const exists = await verifyEntityExists(
			entityType,
			entityId,
			organizationId,
		);

		if (!exists) {
			return { success: true };
		}

		const newId = nanoid(32);

		await db.execute(sql`
			WITH upserted AS (
				INSERT INTO recent_visits (id, organization_id, user_id, entity_type, entity_id, visited_at, created_at)
				VALUES (${newId}, ${organizationId}, ${userId}, ${entityType}, ${entityId}, NOW(), NOW())
				ON CONFLICT (organization_id, user_id, entity_type, entity_id)
				DO UPDATE SET visited_at = NOW()
				RETURNING id
			),
			ranked AS (
				SELECT id, ROW_NUMBER() OVER (
					PARTITION BY organization_id, user_id 
					ORDER BY visited_at DESC, id DESC
				) AS rn
				FROM recent_visits
				WHERE organization_id = ${organizationId} AND user_id = ${userId}
			)
			DELETE FROM recent_visits
			WHERE id IN (SELECT id FROM ranked WHERE rn > 20)
		`);

		return { success: true };
	});
