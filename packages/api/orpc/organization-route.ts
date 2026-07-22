import { ORPCError, os } from "@orpc/server";
import {
	getOrganizationBySlug,
	getOrganizationMembership,
} from "@repo/database";
import type { StudioContext } from "../modules/studio/lib/permissions";

type ProtectedContext = {
	headers: Headers;
	user: StudioContext["user"];
};

type OrganizationRouteContext = Pick<
	StudioContext,
	"organizationId" | "membership"
>;

export async function resolveOrganizationRouteContext(
	organizationSlug: string,
	context: ProtectedContext,
): Promise<OrganizationRouteContext> {
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
		organizationId: organization.id,
		membership: {
			id: membership.id,
			role: membership.role,
			organization: membership.organization,
		},
	};
}

export const organizationRouteMiddleware = os
	.$context<ProtectedContext>()
	.middleware(async ({ context, next }, organizationSlug: string) => {
		const routeContext = await resolveOrganizationRouteContext(
			organizationSlug,
			context,
		);

		return next({ context: routeContext });
	});
