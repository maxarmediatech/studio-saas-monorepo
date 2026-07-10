import { and, asc, db, eq, sql } from "@repo/database";
import { waTemplates } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { toWhatsAppTemplateSummary } from "../lib/template-presenter";
import { listTemplatesInputSchema, listTemplatesOutputSchema } from "../types";

export const listTemplates = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/whatsapp/templates",
		tags: ["WhatsApp"],
		summary: "List synced WhatsApp templates",
	})
	.input(listTemplatesInputSchema)
	.output(listTemplatesOutputSchema)
	.handler(async ({ input, context }) => {
		const conditions = [
			eq(waTemplates.organizationId, context.organizationId),
			eq(waTemplates.accountId, input.accountId),
		];

		if (input.status) {
			conditions.push(eq(waTemplates.status, input.status));
		}

		if (input.category) {
			conditions.push(eq(waTemplates.category, input.category));
		}

		if (input.language) {
			conditions.push(eq(waTemplates.language, input.language));
		}

		if (input.search) {
			const search = `%${input.search}%`;
			conditions.push(
				sql`(${waTemplates.name} ILIKE ${search} OR coalesce(${waTemplates.category}, '') ILIKE ${search})`,
			);
		}

		const templates = await db
			.select()
			.from(waTemplates)
			.where(and(...conditions))
			.orderBy(
				sql`CASE WHEN lower(${waTemplates.status}) = 'approved' THEN 0 ELSE 1 END`,
				asc(waTemplates.name),
				asc(waTemplates.language),
			);

		return {
			data: templates.map(toWhatsAppTemplateSummary),
		};
	});
