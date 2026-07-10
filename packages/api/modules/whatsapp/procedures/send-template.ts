import { ORPCError } from "@orpc/server";
import { and, db, eq } from "@repo/database";
import {
	waAccounts,
	waMessages,
	waOutbox,
	waTemplates,
} from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { ensureWhatsAppContactConversation } from "../lib/contact-conversation";
import { recordOutboundConversationActivity } from "../lib/outbound-activity";
import { inspectWhatsAppTemplate } from "../lib/template-inspector";
import { renderWhatsAppTemplateMessage } from "../lib/template-renderer";
import { triggerWhatsAppOutbox } from "../lib/trigger-outbox";
import { sendTemplateInputSchema, sendTemplateOutputSchema } from "../types";

export const sendTemplate = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/messages/send-template",
		tags: ["WhatsApp"],
		summary: "Send WhatsApp template message",
	})
	.input(sendTemplateInputSchema)
	.output(sendTemplateOutputSchema)
	.handler(async ({ input, context }) => {
		const account = await db.query.waAccounts.findFirst({
			where: and(
				eq(waAccounts.organizationId, context.organizationId),
				eq(waAccounts.id, input.accountId),
			),
		});

		if (!account || account.deletedAt) {
			throw new ORPCError("NOT_FOUND", {
				message: "WhatsApp account not found",
			});
		}

		const template = await db.query.waTemplates.findFirst({
			where: and(
				eq(waTemplates.organizationId, context.organizationId),
				eq(waTemplates.accountId, input.accountId),
				eq(waTemplates.name, input.templateName),
				eq(waTemplates.language, input.language),
			),
		});

		if (!template) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Template is not synced for this account yet. Sync templates and try again.",
			});
		}

		if (template.status.toLowerCase() !== "approved") {
			throw new ORPCError("BAD_REQUEST", {
				message: `Template ${template.name} is ${template.status.toLowerCase()} and cannot be sent.`,
			});
		}

		const inspection = inspectWhatsAppTemplate(template.components);
		if (!inspection.isSupported) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					inspection.unsupportedReason ??
					"Template is not supported by the inbox sender yet.",
			});
		}

		if (
			inspection.variables.length > 0 &&
			(!input.components || input.components.length === 0)
		) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Template requires variables before it can be sent. Fill them in and try again.",
			});
		}

		const { contactId, conversationId } =
			await ensureWhatsAppContactConversation({
				organizationId: context.organizationId,
				accountId: input.accountId,
				waId: input.to,
			});

		const [createdMessage] = await db
			.insert(waMessages)
			.values({
				organizationId: context.organizationId,
				accountId: input.accountId,
				conversationId,
				contactId,
				direction: "outbound",
				type: "template",
				templateName: input.templateName,
				templateParams: {
					language: input.language,
					components: input.components ?? [],
				},
				status: "pending",
			})
			.returning({ id: waMessages.id, createdAt: waMessages.createdAt });

		if (!createdMessage) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create message",
			});
		}

		await recordOutboundConversationActivity({
			organizationId: context.organizationId,
			conversationId,
			contactId,
			messageId: createdMessage.id,
			preview:
				renderWhatsAppTemplateMessage({
					components: template.components,
					params: {
						language: input.language,
						components: input.components ?? [],
					},
				}) ?? `Template: ${input.templateName}`,
			at: createdMessage.createdAt,
		});

		const [outbox] = await db
			.insert(waOutbox)
			.values({
				organizationId: context.organizationId,
				accountId: input.accountId,
				messageId: createdMessage.id,
			})
			.returning({ id: waOutbox.id });

		if (!outbox) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to enqueue message",
			});
		}

		await triggerWhatsAppOutbox({
			outboxId: outbox.id,
			messageId: createdMessage.id,
		});

		return {
			data: { messageId: createdMessage.id, outboxId: outbox.id },
			message: "Message queued",
		};
	});
