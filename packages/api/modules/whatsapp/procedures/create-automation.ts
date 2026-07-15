import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { waBotFlows } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { findActiveWhatsAppAccount } from "../lib/account-repository";
import { toAutomationItem } from "../lib/automation-presenter";
import {
	createAutomationInputSchema,
	createAutomationOutputSchema,
} from "../types";

export const createAutomation = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/automations",
		tags: ["WhatsApp"],
		summary: "Create WhatsApp automation",
	})
	.input(createAutomationInputSchema)
	.output(createAutomationOutputSchema)
	.handler(async ({ input, context }) => {
		const account = await findActiveWhatsAppAccount(
			context.organizationId,
			input.accountId,
		);

		if (!account) {
			throw new ORPCError("NOT_FOUND", {
				message: "WhatsApp account not found",
			});
		}

		if (
			input.triggerType === "keyword" &&
			input.triggerKeywords.length === 0
		) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Keyword automations need at least one keyword",
			});
		}

		const now = new Date();
		const [flow] = await db
			.insert(waBotFlows)
			.values({
				organizationId: context.organizationId,
				accountId: input.accountId,
				name: input.name,
				description: input.description,
				status: input.status,
				triggerType: input.triggerType,
				triggerKeywords: input.triggerKeywords,
				flowData: input.flowData,
				createdByUserId: context.user.id,
				publishedAt: input.status === "published" ? now : null,
				publishedVersion: input.status === "published" ? 1 : null,
				updatedAt: now,
			})
			.returning();

		if (!flow) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create automation",
			});
		}

		return {
			data: toAutomationItem(flow),
			message:
				input.status === "published"
					? "Automation published"
					: "Automation saved as draft",
		};
	});
