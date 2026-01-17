import { and, db, desc, eq, sql } from "@repo/database";
import { waContacts, waConversations } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	listConversationsInputSchema,
	listConversationsOutputSchema,
} from "../types";

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

export const listConversations = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/whatsapp/conversations",
		tags: ["WhatsApp"],
		summary: "List WhatsApp conversations",
	})
	.input(listConversationsInputSchema)
	.output(listConversationsOutputSchema)
	.handler(async ({ input, context }) => {
		const conditions = [
			eq(waConversations.organizationId, context.organizationId),
		];

		if (input.accountId) {
			conditions.push(eq(waConversations.accountId, input.accountId));
		}

		if (input.status) {
			conditions.push(eq(waConversations.status, input.status));
		}

		if (input.search) {
			const search = `%${input.search}%`;
			conditions.push(
				sql`(coalesce(${waContacts.name}, '') ILIKE ${search} OR coalesce(${waContacts.pushName}, '') ILIKE ${search} OR ${waContacts.phoneNumber} ILIKE ${search} OR ${waContacts.waId} ILIKE ${search})`,
			);
		}

		const sortAt = sql<Date>`coalesce(${waConversations.lastMessageAt}, ${waConversations.createdAt})`;

		if (input.cursor) {
			const parsed = parseCursor(input.cursor);
			if (parsed) {
				conditions.push(
					sql`(${sortAt} < ${parsed.createdAt} OR (${sortAt} = ${parsed.createdAt} AND ${waConversations.id} < ${parsed.id}))`,
				);
			}
		}

		const results = await db
			.select({
				conversation: waConversations,
				contact: waContacts,
				sortAt,
			})
			.from(waConversations)
			.innerJoin(waContacts, eq(waConversations.contactId, waContacts.id))
			.where(and(...conditions))
			.orderBy(desc(sortAt), desc(waConversations.id))
			.limit(input.limit + 1);

		const hasMore = results.length > input.limit;
		const items = hasMore ? results.slice(0, input.limit) : results;
		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem ? encodeCursor(lastItem.sortAt, lastItem.conversation.id) : null;

		return {
			data: items.map(({ conversation, contact }) => ({
				id: conversation.id,
				accountId: conversation.accountId,
				contactId: conversation.contactId,
				status: conversation.status,
				unreadCount: conversation.unreadCount ?? 0,
				lastMessageId: conversation.lastMessageId ?? null,
				lastMessageAt: conversation.lastMessageAt ?? null,
				lastMessagePreview: conversation.lastMessagePreview ?? null,
				createdAt: conversation.createdAt,
				updatedAt: conversation.updatedAt,
				contact: {
					id: contact.id,
					waId: contact.waId,
					phoneNumber: contact.phoneNumber,
					pushName: contact.pushName ?? null,
					name: contact.name ?? null,
					lastMessageAt: contact.lastMessageAt ?? null,
				},
			})),
			nextCursor,
		};
	});
