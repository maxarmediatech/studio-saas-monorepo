import { ORPCError } from "@orpc/client";
import { hasAnyRole } from "@repo/auth/lib/permissions";
import { getOrganizationMembership, getPurchaseById } from "@repo/database";

export async function getManageablePurchase({
	purchaseId,
	userId,
}: {
	purchaseId: string;
	userId: string;
}) {
	const purchase = await getPurchaseById(purchaseId);

	if (!purchase) {
		throw new ORPCError("FORBIDDEN");
	}

	if (purchase.organizationId) {
		const membership = await getOrganizationMembership(
			purchase.organizationId,
			userId,
		);

		if (!membership || !hasAnyRole(membership.role, ["owner"])) {
			throw new ORPCError("FORBIDDEN");
		}
	}

	if (purchase.userId && purchase.userId !== userId) {
		throw new ORPCError("FORBIDDEN");
	}

	return purchase;
}
