import {
	and,
	clients,
	crews,
	db,
	desc,
	eq,
	inArray,
	isNull,
	sql,
} from "@repo/database";
import { waContacts, waConversations } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { toConversationItem } from "../lib/conversation-presenter";
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

function normalizePhone(value: string | null | undefined) {
	return value?.replace(/\D/g, "") ?? "";
}

const normalizedWaContactPhone = sql<string>`regexp_replace(coalesce(${waContacts.phoneNumber}, ''), '[^0-9]', '', 'g')`;
const normalizedWaContactId = sql<string>`regexp_replace(coalesce(${waContacts.waId}, ''), '[^0-9]', '', 'g')`;
const normalizedClientPhone = sql<string>`regexp_replace(coalesce(${clients.phoneNumber}, ''), '[^0-9]', '', 'g')`;
const normalizedCrewPhone = sql<string>`regexp_replace(coalesce(${crews.phoneNumber}, ''), '[^0-9]', '', 'g')`;

const clientPhoneMatchesContact = sql`
	${normalizedClientPhone} IN (${normalizedWaContactPhone}, ${normalizedWaContactId})
`;
const crewPhoneMatchesContact = sql`
	${normalizedCrewPhone} IN (${normalizedWaContactPhone}, ${normalizedWaContactId})
`;

function clientContactExists(search?: string) {
	return sql`EXISTS (
		SELECT 1
		FROM ${clients}
		WHERE ${clients.organizationId} = ${waContacts.organizationId}
			AND ${clients.deletedAt} IS NULL
			${search ? sql`AND ${clients.name} ILIKE ${search}` : sql``}
			AND ${clientPhoneMatchesContact}
	)`;
}

function crewContactExists(search?: string) {
	return sql`EXISTS (
		SELECT 1
		FROM ${crews}
		WHERE ${crews.organizationId} = ${waContacts.organizationId}
			AND ${crews.deletedAt} IS NULL
			${search ? sql`AND ${crews.name} ILIKE ${search}` : sql``}
			AND ${crewPhoneMatchesContact}
	)`;
}

async function getSavedContactNameByPhone(params: {
	organizationId: string;
	phoneNumbers: string[];
}) {
	const normalizedPhones = [
		...new Set(params.phoneNumbers.map(normalizePhone).filter(Boolean)),
	];

	if (normalizedPhones.length === 0) {
		return new Map<string, string>();
	}

	const [clientMatches, crewMatches] = await Promise.all([
		db
			.select({
				name: clients.name,
				phoneNumber: clients.phoneNumber,
			})
			.from(clients)
			.where(
				and(
					eq(clients.organizationId, params.organizationId),
					isNull(clients.deletedAt),
					inArray(normalizedClientPhone, normalizedPhones),
				),
			),
		db
			.select({
				name: crews.name,
				phoneNumber: crews.phoneNumber,
			})
			.from(crews)
			.where(
				and(
					eq(crews.organizationId, params.organizationId),
					isNull(crews.deletedAt),
					inArray(normalizedCrewPhone, normalizedPhones),
				),
			),
	]);

	const namesByPhone = new Map<string, string>();

	for (const match of [...crewMatches, ...clientMatches]) {
		const normalizedPhone = normalizePhone(match.phoneNumber);
		if (normalizedPhone) {
			namesByPhone.set(normalizedPhone, match.name);
		}
	}

	return namesByPhone;
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

		if (input.assignment === "mine") {
			conditions.push(
				eq(waConversations.assignedToUserId, context.user.id),
			);
		}

		if (input.assignment === "unassigned") {
			conditions.push(sql`${waConversations.assignedToUserId} IS NULL`);
		}

		if (input.contactType === "client") {
			conditions.push(sql`NOT ${crewContactExists()}`);
		}

		if (input.contactType === "crew") {
			conditions.push(crewContactExists());
		}

		if (input.search) {
			const search = `%${input.search}%`;
			conditions.push(
				sql`(
					coalesce(${waContacts.name}, '') ILIKE ${search}
					OR coalesce(${waContacts.pushName}, '') ILIKE ${search}
					OR ${waContacts.phoneNumber} ILIKE ${search}
					OR ${waContacts.waId} ILIKE ${search}
					OR ${clientContactExists(search)}
					OR ${crewContactExists(search)}
				)`,
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
			hasMore && lastItem
				? encodeCursor(lastItem.sortAt, lastItem.conversation.id)
				: null;
		const savedNamesByPhone = await getSavedContactNameByPhone({
			organizationId: context.organizationId,
			phoneNumbers: items.flatMap(({ contact }) => [
				contact.phoneNumber,
				contact.waId,
			]),
		});

		return {
			data: items.map(({ conversation, contact }) => {
				const item = toConversationItem(conversation, contact);
				const savedName =
					savedNamesByPhone.get(
						normalizePhone(contact.phoneNumber),
					) ??
					savedNamesByPhone.get(normalizePhone(contact.waId)) ??
					null;

				if (item.contact.name || !savedName) {
					return item;
				}

				return {
					...item,
					contact: {
						...item.contact,
						name: savedName,
					},
				};
			}),
			nextCursor,
		};
	});
