import { ORPCError } from "@orpc/server";
import { and, eq, isNull, crews, db } from "@repo/database";

/**
 * Get the crew record for the current user in the organization.
 * Throws NOT_FOUND if user is not a crew member.
 */
export async function getMyCrewId(
	userId: string,
	organizationId: string,
): Promise<string> {
	const crew = await db.query.crews.findFirst({
		where: and(
			eq(crews.userId, userId),
			eq(crews.organizationId, organizationId),
			isNull(crews.deletedAt),
		),
		columns: { id: true },
	});

	if (!crew) {
		throw new ORPCError("NOT_FOUND", {
			message: "You are not registered as a crew member in this organization",
		});
	}

	return crew.id;
}
