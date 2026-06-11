import { ORPCError } from "@orpc/server";
import {
	getOrganizationBySlug,
	getOrganizationMembership,
} from "@repo/database";
import type { StudioContext } from "../../studio/lib/permissions";

type ProtectedContext = Pick<StudioContext, "headers" | "user"> & {
	session: Omit<StudioContext["session"], "activeOrganizationId"> & {
		activeOrganizationId?: string | null;
	};
};

export async function resolveDiscussionRouteContext(
	organizationSlug: string,
	context: ProtectedContext,
): Promise<StudioContext> {
	const organization = await getOrganizationBySlug(organizationSlug);

	if (!organization) {
		throw new ORPCError("NOT_FOUND", {
			message: "Organization not found",
		});
	}

	const membership = await getOrganizationMembership(
		organization.id,
		context.user.id,
	);

	if (!membership) {
		throw new ORPCError("FORBIDDEN", {
			message: "Not a member of this organization",
		});
	}

	return {
		...context,
		session: {
			...context.session,
			activeOrganizationId: context.session.activeOrganizationId ?? null,
		},
		organizationId: organization.id,
		membership: {
			id: membership.id,
			role: membership.role,
			organization: membership.organization,
		},
	};
}
