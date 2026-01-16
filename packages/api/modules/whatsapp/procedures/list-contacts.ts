import { and, db, desc, eq, sql } from "@repo/database";
import { waContacts } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { listContactsInputSchema, listContactsOutputSchema } from "../types";

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

export const listContacts = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/whatsapp/contacts",
		tags: ["WhatsApp"],
		summary: "List WhatsApp contacts",
	})
	.input(listContactsInputSchema)
	.output(listContactsOutputSchema)
	.handler(async ({ input, context }) => {
		const conditions = [eq(waContacts.organizationId, context.organizationId)];

		if (input.search) {
			const search = `%${input.search}%`;
			conditions.push(
				sql`(coalesce(${waContacts.name}, '') ILIKE ${search} OR coalesce(${waContacts.pushName}, '') ILIKE ${search} OR ${waContacts.phoneNumber} ILIKE ${search} OR ${waContacts.waId} ILIKE ${search})`,
			);
		}

		if (input.cursor) {
			const parsed = parseCursor(input.cursor);
			if (parsed) {
				conditions.push(
					sql`(${waContacts.createdAt} < ${parsed.createdAt} OR (${waContacts.createdAt} = ${parsed.createdAt} AND ${waContacts.id} < ${parsed.id}))`,
				);
			}
		}

		const results = await db.query.waContacts.findMany({
			where: and(...conditions),
			orderBy: [desc(waContacts.createdAt), desc(waContacts.id)],
			limit: input.limit + 1,
		});

		const hasMore = results.length > input.limit;
		const items = hasMore ? results.slice(0, input.limit) : results;
		const lastItem = items[items.length - 1];
		const nextCursor =
			hasMore && lastItem ? encodeCursor(lastItem.createdAt, lastItem.id) : null;

		return {
			data: items.map((contact) => ({
				id: contact.id,
				waId: contact.waId,
				phoneNumber: contact.phoneNumber,
				pushName: contact.pushName ?? null,
				name: contact.name ?? null,
				lastMessageAt: contact.lastMessageAt ?? null,
				createdAt: contact.createdAt,
				updatedAt: contact.updatedAt,
			})),
			nextCursor,
		};
	});
