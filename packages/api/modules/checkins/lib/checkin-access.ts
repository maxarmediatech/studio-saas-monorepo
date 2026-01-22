import { ORPCError } from "@orpc/server";
import { hasAnyRole } from "@repo/auth/lib/permissions";
import {
	and,
	checkins,
	checkinTypes,
	db,
	eq,
	isNull,
	teamMembers,
} from "@repo/database";

const ADMIN_ROLES = ["owner", "admin"];

interface CheckinAccessContext {
	organizationId: string;
	user: { id: string };
	membership: { role: string | string[] };
}

export function canViewAllCheckins(role: string | string[]): boolean {
	return hasAnyRole(role, ADMIN_ROLES);
}

export async function assertCheckinTypeAccess(
	checkinTypeId: string,
	context: CheckinAccessContext,
): Promise<typeof checkinTypes.$inferSelect> {
	const checkinType = await db.query.checkinTypes.findFirst({
		where: and(
			eq(checkinTypes.id, checkinTypeId),
			eq(checkinTypes.organizationId, context.organizationId),
			isNull(checkinTypes.deletedAt),
		),
	});

	if (!checkinType) {
		throw new ORPCError("NOT_FOUND", { message: "Checkin type not found" });
	}

	if (canViewAllCheckins(context.membership.role)) {
		return checkinType;
	}

	const teamMembership = await db.query.teamMembers.findFirst({
		where: and(
			eq(teamMembers.teamId, checkinType.teamId),
			eq(teamMembers.userId, context.user.id),
		),
	});

	if (!teamMembership) {
		throw new ORPCError("FORBIDDEN", {
			message: "Not a member of this team",
		});
	}

	return checkinType;
}

export async function assertCheckinAccess(
	checkinId: string,
	context: CheckinAccessContext,
): Promise<typeof checkins.$inferSelect> {
	const checkin = await db.query.checkins.findFirst({
		where: and(
			eq(checkins.id, checkinId),
			eq(checkins.organizationId, context.organizationId),
			isNull(checkins.deletedAt),
		),
		with: {
			checkinType: true,
		},
	});

	if (!checkin) {
		throw new ORPCError("NOT_FOUND", { message: "Checkin not found" });
	}

	if (canViewAllCheckins(context.membership.role)) {
		return checkin;
	}

	const teamMembership = await db.query.teamMembers.findFirst({
		where: and(
			eq(teamMembers.teamId, checkin.checkinType.teamId),
			eq(teamMembers.userId, context.user.id),
		),
	});

	if (!teamMembership) {
		throw new ORPCError("FORBIDDEN", {
			message: "Not a member of this team",
		});
	}

	return checkin;
}

export async function assertCheckinOwnership(
	checkinId: string,
	context: CheckinAccessContext,
): Promise<typeof checkins.$inferSelect> {
	const checkin = await assertCheckinAccess(checkinId, context);

	if (
		checkin.createdBy !== context.user.id &&
		!canViewAllCheckins(context.membership.role)
	) {
		throw new ORPCError("FORBIDDEN", {
			message: "You can only modify your own checkins",
		});
	}

	return checkin;
}

export async function getTeamsForUser(
	userId: string,
	organizationId: string,
): Promise<string[]> {
	const memberships = await db.query.teamMembers.findMany({
		where: eq(teamMembers.userId, userId),
		with: {
			team: {
				columns: { id: true, organizationId: true },
			},
		},
	});

	return memberships
		.filter((m) => m.team.organizationId === organizationId)
		.map((m) => m.teamId);
}
