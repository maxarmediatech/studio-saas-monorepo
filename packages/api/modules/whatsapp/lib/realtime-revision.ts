import { db, desc, eq, sql } from "@repo/database";
import { waConversations, waMessages } from "@repo/whatsapp-db";

const conversationActivityAt = sql<Date>`greatest(
	coalesce(${waConversations.lastMessageAt}, ${waConversations.createdAt}),
	coalesce(${waConversations.updatedAt}, ${waConversations.createdAt}),
	${waConversations.createdAt}
)`;
const messageActivityAt = sql<Date>`coalesce(${waMessages.statusUpdatedAt}, ${waMessages.createdAt})`;

const encodeRevisionPart = (params: {
	id: string | null;
	timestamp: Date | null;
}) => `${params.timestamp?.toISOString() ?? "0"}:${params.id ?? "0"}`;

export async function getWhatsAppRealtimeRevision(
	organizationId: string,
): Promise<string> {
	const [latestConversation, latestMessage] = await Promise.all([
		db
			.select({
				id: waConversations.id,
				activityAt: conversationActivityAt,
			})
			.from(waConversations)
			.where(eq(waConversations.organizationId, organizationId))
			.orderBy(desc(conversationActivityAt), desc(waConversations.id))
			.limit(1)
			.then((rows) => rows[0] ?? null),
		db
			.select({
				id: waMessages.id,
				activityAt: messageActivityAt,
			})
			.from(waMessages)
			.where(eq(waMessages.organizationId, organizationId))
			.orderBy(desc(messageActivityAt), desc(waMessages.id))
			.limit(1)
			.then((rows) => rows[0] ?? null),
	]);

	return [
		encodeRevisionPart({
			id: latestConversation?.id ?? null,
			timestamp: latestConversation?.activityAt ?? null,
		}),
		encodeRevisionPart({
			id: latestMessage?.id ?? null,
			timestamp: latestMessage?.activityAt ?? null,
		}),
	].join("|");
}
