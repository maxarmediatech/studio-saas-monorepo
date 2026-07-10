import { and, db, desc, eq, sql } from "@repo/database";
import { waBotFlows } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { toAutomationItem } from "../lib/automation-presenter";
import {
	listAutomationsInputSchema,
	listAutomationsOutputSchema,
} from "../types";

export const listAutomations = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/whatsapp/automations",
		tags: ["WhatsApp"],
		summary: "List WhatsApp automations",
	})
	.input(listAutomationsInputSchema)
	.output(listAutomationsOutputSchema)
	.handler(async ({ input, context }) => {
		const conditions = [
			eq(waBotFlows.organizationId, context.organizationId),
		];

		if (input.status) {
			conditions.push(eq(waBotFlows.status, input.status));
		}

		if (input.search) {
			const search = `%${input.search}%`;
			conditions.push(
				sql`(${waBotFlows.name} ILIKE ${search} OR coalesce(${waBotFlows.description}, '') ILIKE ${search})`,
			);
		}

		const flows = await db
			.select()
			.from(waBotFlows)
			.where(and(...conditions))
			.orderBy(desc(waBotFlows.updatedAt), desc(waBotFlows.id));

		return {
			data: flows.map(toAutomationItem),
		};
	});
