import { db, sql } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	listContactTagsInputSchema,
	listContactTagsOutputSchema,
} from "../types";

export const listContactTags = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/whatsapp/contact-tags",
		tags: ["WhatsApp"],
		summary: "List WhatsApp contact tags",
	})
	.input(listContactTagsInputSchema)
	.output(listContactTagsOutputSchema)
	.handler(async ({ input, context }) => {
		const searchPattern = input.search ? `%${input.search}%` : null;
		const result = await db.execute(sql`
			SELECT tag.name, count(*)::int AS "contactCount"
			FROM wa_contacts
			CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(tags, '[]'::jsonb)) AS tag(name)
			WHERE organization_id = ${context.organizationId}
				AND (${searchPattern}::text IS NULL OR tag.name ILIKE ${searchPattern})
			GROUP BY tag.name
			ORDER BY count(*) DESC, tag.name ASC
		`);
		const rows = result.rows as { name: string; contactCount: number }[];

		return {
			data: rows,
		};
	});
