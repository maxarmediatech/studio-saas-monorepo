import { eq, shootCalendarEvents } from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";

export async function markCancellationForManualReconciliation(
	tx: TransactionClient,
	mappingId: string,
	reason: string,
	terminalIntent: boolean,
) {
	await tx
		.update(shootCalendarEvents)
		.set({
			...(terminalIntent ? { intentState: "cancelled" } : {}),
			syncStatus: "error",
			lastError: reason,
			cancellationSyncStatus: "manual_reconciliation",
			cancellationLastError: reason,
			updatedAt: new Date(),
		})
		.where(eq(shootCalendarEvents.id, mappingId));
}
