import { ORPCError } from "@orpc/server";
import { documentSequences, sql } from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import { getQuoteNumberPrefix } from "./quote-number-format";

/** Format: {STUDIO_PREFIX}-Q-{YYMM}-{XXXX}; counter is tenant/month scoped. */
export async function allocateQuoteNumber(
	tx: TransactionClient,
	organizationId: string,
	organizationName: string,
	organizationTimeZone: string,
	now = new Date(),
): Promise<string> {
	const prefix = getQuoteNumberPrefix(
		organizationName,
		organizationTimeZone,
		now,
	);
	const timestamp = new Date();
	const [sequence] = await tx
		.insert(documentSequences)
		.values({
			organizationId,
			documentType: "quote",
			scopeKey: prefix,
			nextValue: 2,
			updatedAt: timestamp,
		})
		.onConflictDoUpdate({
			target: [
				documentSequences.organizationId,
				documentSequences.documentType,
				documentSequences.scopeKey,
			],
			set: {
				nextValue: sql`${documentSequences.nextValue} + 1`,
				updatedAt: timestamp,
			},
		})
		.returning({
			allocated: sql<number>`${documentSequences.nextValue} - 1`,
		});
	const allocated = sequence?.allocated;
	if (!allocated) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Failed to allocate quote number",
		});
	}
	if (allocated > 9999) {
		throw new ORPCError("CONFLICT", {
			message: "Monthly quote number limit reached",
		});
	}
	return `${prefix}-${String(allocated).padStart(4, "0")}`;
}
