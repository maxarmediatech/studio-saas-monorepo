import { ORPCError } from "@orpc/server";
import { and, db, eq } from "@repo/database";
import { waBotFlows } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { toAutomationItem } from "../lib/automation-presenter";
import {
	updateAutomationStatusInputSchema,
	updateAutomationStatusOutputSchema,
} from "../types";

export const updateAutomationStatus = studioProtectedProcedure
	.route({
		method: "PATCH",
		path: "/whatsapp/automations/:automationId/status",
		tags: ["WhatsApp"],
		summary: "Update WhatsApp automation status",
	})
	.input(updateAutomationStatusInputSchema)
	.output(updateAutomationStatusOutputSchema)
	.handler(async ({ input, context }) => {
		const now = new Date();
		const [flow] = await db
			.update(waBotFlows)
			.set({
				status: input.status,
				updatedAt: now,
				...(input.status === "published"
					? { publishedAt: now, publishedVersion: 1 }
					: {}),
			})
			.where(
				and(
					eq(waBotFlows.organizationId, context.organizationId),
					eq(waBotFlows.id, input.automationId),
				),
			)
			.returning();

		if (!flow) {
			throw new ORPCError("NOT_FOUND", {
				message: "Automation not found",
			});
		}

		return {
			data: toAutomationItem(flow),
			message: "Automation status updated",
		};
	});
