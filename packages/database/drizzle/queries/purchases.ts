import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../client";
import { purchases } from "../schema";
import type { PurchaseInsertSchema, PurchaseUpdateSchema } from "../zod";

export async function getPurchasesByOrganizationId(organizationId: string) {
	return db.query.purchases.findMany({
		where: (purchase, { eq }) =>
			eq(purchase.organizationId, organizationId),
	});
}

export async function getPurchasesByUserId(userId: string) {
	return db.query.purchases.findMany({
		where: (purchase, { eq }) => eq(purchase.userId, userId),
	});
}

export async function getPurchaseById(id: string) {
	return db.query.purchases.findFirst({
		where: (purchase, { eq }) => eq(purchase.id, id),
	});
}

export async function getPurchaseBySubscriptionId(subscriptionId: string) {
	return db.query.purchases.findFirst({
		where: (purchase, { eq }) =>
			eq(purchase.subscriptionId, subscriptionId),
	});
}

export async function createPurchase(
	insertedPurchase: z.infer<typeof PurchaseInsertSchema>,
) {
	const [row] = await db
		.insert(purchases)
		.values(insertedPurchase)
		.returning({ id: purchases.id });

	if (!row) {
		throw new Error("Failed to insert purchase");
	}

	return getPurchaseById(row.id);
}

export async function updatePurchase(
	updatedPurchase: z.infer<typeof PurchaseUpdateSchema>,
) {
	const [row] = await db
		.update(purchases)
		.set(updatedPurchase)
		.returning({ id: purchases.id });

	if (!row) {
		throw new Error("Failed to update purchase");
	}

	return getPurchaseById(row.id);
}

export async function deletePurchaseBySubscriptionId(subscriptionId: string) {
	await db
		.delete(purchases)
		.where(eq(purchases.subscriptionId, subscriptionId));
}
