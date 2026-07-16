import { and, type db, eq, isNull, receivedAmounts, sql } from "@repo/database";

export type ReceivedPaymentTransaction = Pick<typeof db, "execute" | "query">;

/**
 * Serializes all mutations and receipt issuance for one received payment.
 * PostgreSQL holds this row lock until the surrounding transaction commits.
 */
export async function getLockedReceivedPayment(
	tx: ReceivedPaymentTransaction,
	{
		organizationId,
		receivedAmountId,
	}: {
		organizationId: string;
		receivedAmountId: string;
	},
) {
	await tx.execute(sql`
		SELECT ${receivedAmounts.id}
		FROM ${receivedAmounts}
		WHERE ${receivedAmounts.id} = ${receivedAmountId}
			AND ${receivedAmounts.organizationId} = ${organizationId}
			AND ${receivedAmounts.deletedAt} IS NULL
		FOR UPDATE
	`);

	return tx.query.receivedAmounts.findFirst({
		where: and(
			eq(receivedAmounts.id, receivedAmountId),
			eq(receivedAmounts.organizationId, organizationId),
			isNull(receivedAmounts.deletedAt),
		),
	});
}
