import { and, count, db, desc, eq, gte, sql } from "@repo/database";
import {
	waCampaigns,
	waContacts,
	waConversations,
	waMessages,
} from "@repo/whatsapp-db";

export async function getWhatsAppDashboardData({
	organizationId,
	today,
	rangeStartDate,
	rangeEndDate,
}: {
	organizationId: string;
	today: string;
	rangeStartDate: Date;
	rangeEndDate: Date;
}) {
	const [conversationsTodayResult] = await db
		.select({ count: count().mapWith(Number) })
		.from(waConversations)
		.where(
			and(
				eq(waConversations.organizationId, organizationId),
				gte(
					waConversations.createdAt,
					new Date(`${today}T00:00:00.000Z`),
				),
				sql`${waConversations.createdAt} <= ${new Date(`${today}T23:59:59.999Z`)}`,
			),
		);

	const [messageStatusResult] = await db
		.select({
			sent: sql<number>`count(*) FILTER (WHERE ${waMessages.direction} = 'outbound' AND ${waMessages.status} IN ('sent', 'delivered', 'read'))::int`,
			delivered: sql<number>`count(*) FILTER (WHERE ${waMessages.direction} = 'outbound' AND ${waMessages.status} IN ('delivered', 'read'))::int`,
			read: sql<number>`count(*) FILTER (WHERE ${waMessages.direction} = 'outbound' AND ${waMessages.status} = 'read')::int`,
			failed: sql<number>`count(*) FILTER (WHERE ${waMessages.direction} = 'outbound' AND ${waMessages.status} = 'failed')::int`,
		})
		.from(waMessages)
		.where(
			and(
				eq(waMessages.organizationId, organizationId),
				gte(waMessages.createdAt, rangeStartDate),
				sql`${waMessages.createdAt} <= ${rangeEndDate}`,
			),
		);

	const [campaignSummaryResult] = await db
		.select({
			total: count().mapWith(Number),
			running: sql<number>`count(*) FILTER (WHERE ${waCampaigns.status} = 'running')::int`,
			scheduled: sql<number>`count(*) FILTER (WHERE ${waCampaigns.status} = 'scheduled')::int`,
			completed: sql<number>`count(*) FILTER (WHERE ${waCampaigns.status} = 'completed')::int`,
			totalRecipients: sql<number>`coalesce(sum(${waCampaigns.estimatedRecipients}), 0)::int`,
		})
		.from(waCampaigns)
		.where(
			and(
				eq(waCampaigns.organizationId, organizationId),
				gte(waCampaigns.createdAt, rangeStartDate),
				sql`${waCampaigns.createdAt} <= ${rangeEndDate}`,
			),
		);

	const responseTimeResult = await db.execute(sql`
		WITH inbound_messages AS (
			SELECT
				inbound.conversation_id,
				inbound.created_at,
				(
					SELECT min(outbound.created_at)
					FROM wa_messages outbound
					WHERE outbound.organization_id = inbound.organization_id
						AND outbound.conversation_id = inbound.conversation_id
						AND outbound.direction = 'outbound'
						AND outbound.created_at > inbound.created_at
				) AS next_outbound_at
			FROM wa_messages inbound
			WHERE inbound.organization_id = ${organizationId}
				AND inbound.direction = 'inbound'
				AND inbound.created_at >= ${rangeStartDate}
				AND inbound.created_at <= ${rangeEndDate}
		)
		SELECT avg(extract(epoch FROM (next_outbound_at - created_at)) / 60)::float AS "responseTimeMinutes"
		FROM inbound_messages
		WHERE next_outbound_at IS NOT NULL
	`);
	const responseTimeMinutes = (
		responseTimeResult.rows[0] as
			| { responseTimeMinutes: number | null }
			| undefined
	)?.responseTimeMinutes;

	const topContacts = await db
		.select({
			id: waContacts.id,
			name: sql<string>`coalesce(${waContacts.name}, ${waContacts.pushName}, ${waContacts.phoneNumber})`,
			phoneNumber: waContacts.phoneNumber,
			messageCount: count(waMessages.id).mapWith(Number),
			lastMessageAt: sql<Date | null>`max(${waMessages.createdAt})`,
		})
		.from(waMessages)
		.innerJoin(waContacts, eq(waContacts.id, waMessages.contactId))
		.where(
			and(
				eq(waMessages.organizationId, organizationId),
				gte(waMessages.createdAt, rangeStartDate),
				sql`${waMessages.createdAt} <= ${rangeEndDate}`,
			),
		)
		.groupBy(waContacts.id)
		.orderBy(sql`count(${waMessages.id}) DESC`)
		.limit(5);

	const recentActivity = await db
		.select({
			id: waMessages.id,
			contactName: sql<string>`coalesce(${waContacts.name}, ${waContacts.pushName}, ${waContacts.phoneNumber})`,
			phoneNumber: waContacts.phoneNumber,
			direction: waMessages.direction,
			status: waMessages.status,
			preview: sql<string>`coalesce(${waMessages.textBody}, ${waMessages.caption}, ${waMessages.templateName}, ${waMessages.type}::text)`,
			createdAt: waMessages.createdAt,
		})
		.from(waMessages)
		.innerJoin(waContacts, eq(waContacts.id, waMessages.contactId))
		.where(eq(waMessages.organizationId, organizationId))
		.orderBy(desc(waMessages.createdAt), desc(waMessages.id))
		.limit(5);

	return {
		conversationsToday: conversationsTodayResult?.count ?? 0,
		responseTimeMinutes:
			typeof responseTimeMinutes === "number"
				? Math.round(responseTimeMinutes)
				: null,
		messages: {
			sent: messageStatusResult?.sent ?? 0,
			delivered: messageStatusResult?.delivered ?? 0,
			read: messageStatusResult?.read ?? 0,
			failed: messageStatusResult?.failed ?? 0,
		},
		campaigns: {
			total: campaignSummaryResult?.total ?? 0,
			running: campaignSummaryResult?.running ?? 0,
			scheduled: campaignSummaryResult?.scheduled ?? 0,
			completed: campaignSummaryResult?.completed ?? 0,
			totalRecipients: campaignSummaryResult?.totalRecipients ?? 0,
		},
		topContacts: topContacts.map((contact) => ({
			id: contact.id,
			name: contact.name,
			phoneNumber: contact.phoneNumber,
			messageCount: contact.messageCount,
			lastMessageAt: contact.lastMessageAt?.toISOString() ?? null,
		})),
		recentActivity: recentActivity.map((activity) => ({
			id: activity.id,
			contactName: activity.contactName,
			phoneNumber: activity.phoneNumber,
			direction: activity.direction,
			status: activity.status,
			preview: activity.preview,
			createdAt: activity.createdAt.toISOString(),
		})),
	};
}
