import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../client";
import { webhookEvents } from "../schema";
import type { WebhookEventInsertSchema } from "../zod";

export async function getWebhookEventByWebhookId(webhookId: string) {
	return db.query.webhookEvents.findFirst({
		where: (event, { eq }) => eq(event.webhookId, webhookId),
	});
}

export async function createWebhookEvent(
	data: z.infer<typeof WebhookEventInsertSchema>,
) {
	const [row] = await db
		.insert(webhookEvents)
		.values(data)
		.returning({ id: webhookEvents.id });

	if (!row) {
		throw new Error("Failed to insert webhook event");
	}

	return row.id;
}

export async function markWebhookEventProcessed(id: string) {
	await db
		.update(webhookEvents)
		.set({
			processed: true,
			processedAt: new Date(),
			errorMessage: null,
		})
		.where(eq(webhookEvents.id, id));
}

export async function markWebhookEventFailed(id: string, errorMessage: string) {
	await db
		.update(webhookEvents)
		.set({
			processed: false,
			processedAt: new Date(),
			errorMessage,
		})
		.where(eq(webhookEvents.id, id));
}
