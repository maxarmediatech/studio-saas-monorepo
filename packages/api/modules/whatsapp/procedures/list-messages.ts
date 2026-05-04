import { and, db, desc, eq, sql } from "@repo/database";
import { waMedia, waMessages, waTemplates } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { renderWhatsAppTemplateMessage } from "../lib/template-renderer";
import { listMessagesInputSchema, listMessagesOutputSchema } from "../types";

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

export const listMessages = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/whatsapp/conversations/:conversationId/messages",
		tags: ["WhatsApp"],
		summary: "List WhatsApp messages in a conversation",
	})
	.input(listMessagesInputSchema)
	.output(listMessagesOutputSchema)
	.handler(async ({ input, context }) => {
		const conditions = [
			eq(waMessages.organizationId, context.organizationId),
			eq(waMessages.conversationId, input.conversationId),
		];

		if (input.direction) {
			conditions.push(eq(waMessages.direction, input.direction));
		}

		if (input.cursor) {
			const parsed = parseCursor(input.cursor);
			if (parsed) {
				conditions.push(
					sql`(${waMessages.createdAt} < ${parsed.createdAt} OR (${waMessages.createdAt} = ${parsed.createdAt} AND ${waMessages.id} < ${parsed.id}))`,
				);
			}
		}

		const templateLanguage = sql<string>`coalesce(${waMessages.templateParams}->>'language', '')`;

		const results = await db
			.select({
				message: waMessages,
				media: waMedia,
				template: waTemplates,
			})
			.from(waMessages)
			.leftJoin(waMedia, eq(waMessages.mediaId, waMedia.id))
			.leftJoin(
				waTemplates,
				and(
					eq(waTemplates.organizationId, waMessages.organizationId),
					eq(waTemplates.accountId, waMessages.accountId),
					eq(waTemplates.name, waMessages.templateName),
					eq(waTemplates.language, templateLanguage),
				),
			)
			.where(and(...conditions))
			.orderBy(desc(waMessages.createdAt), desc(waMessages.id))
			.limit(input.limit + 1);

		const hasMore = results.length > input.limit;
		const items = hasMore ? results.slice(0, input.limit) : results;
		const lastItem = items[items.length - 1]?.message;
		const nextCursor =
			hasMore && lastItem
				? encodeCursor(lastItem.createdAt, lastItem.id)
				: null;

		return {
			data: items.map(({ message, media, template }) => ({
				id: message.id,
				conversationId: message.conversationId,
				contactId: message.contactId,
				accountId: message.accountId,
				direction: message.direction,
				type: message.type,
				textBody: message.textBody ?? null,
				caption: message.caption ?? null,
				media: media
					? {
							id: media.id,
							accessUrl:
								media.ingestStatus === "ready" &&
								media.storageType !== "provider" &&
								media.storageUrl
									? `/api/whatsapp/media/${media.id}`
									: null,
							ingestStatus: media.ingestStatus,
							ingestErrorMessage:
								media.ingestErrorMessage ?? null,
							storageUrl: media.storageUrl ?? null,
							mimeType: media.mimeType,
							fileName: media.fileName ?? null,
						}
					: null,
				templateName: message.templateName ?? null,
				templateParams: message.templateParams ?? null,
				templateRenderedText: template
					? renderWhatsAppTemplateMessage({
							components: template.components,
							params: message.templateParams,
						})
					: null,
				status: message.status,
				statusUpdatedAt: message.statusUpdatedAt ?? null,
				providerMessageId: message.providerMessageId ?? null,
				providerTimestamp: message.providerTimestamp ?? null,
				errorCode: message.errorCode ?? null,
				errorMessage: message.errorMessage ?? null,
				createdAt: message.createdAt,
			})),
			nextCursor,
		};
	});
