import { and, eq, isNull, lte, quotes } from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";

/** Idempotently expires all due sent quotes for one organization. */
export async function expireDueQuotes(
	tx: TransactionClient,
	organizationId: string,
	now = new Date(),
): Promise<number> {
	const changed = await tx
		.update(quotes)
		.set({ status: "expired", expiredAt: now, updatedAt: now })
		.where(
			and(
				eq(quotes.organizationId, organizationId),
				eq(quotes.status, "sent"),
				isNull(quotes.deletedAt),
				lte(quotes.expiresAt, now),
			),
		)
		.returning({ id: quotes.id });
	return changed.length;
}
