import { ORPCError, os } from "@orpc/server";
import { auth } from "@repo/auth";
import { config } from "@repo/config";
import { getOrganizationMembership } from "@repo/database";

export const publicProcedure = os.$context<{
	headers: Headers;
}>();

export const protectedProcedure = publicProcedure.use(
	async ({ context, next }) => {
		const session = await auth.api.getSession({
			headers: context.headers,
		});

		if (!session) {
			throw new ORPCError("UNAUTHORIZED");
		}

		return await next({
			context: {
				...context,
				session: session.session,
				user: session.user,
			},
		});
	},
);

export const adminProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		const isPlatformAdmin = config.auth.platformAdminUserIds.some(
			(adminUserId) => adminUserId === context.user.id,
		);

		if (!isPlatformAdmin) {
			throw new ORPCError("FORBIDDEN");
		}

		return await next();
	},
);

/**
 * Studio-aware protected procedure for multi-tenant studio domain endpoints.
 *
 * This procedure:
 * 1. Validates user is authenticated (inherited from protectedProcedure)
 * 2. Extracts activeOrganizationId from session
 * 3. Validates user is a member of that organization
 * 4. Injects organizationId and membership into context
 *
 * Studio procedures without an organization in their input MUST use this.
 * Route-scoped procedures may use protectedProcedure with an explicit
 * organization resolver so multiple browser tabs remain independent.
 */
export const studioProtectedProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		const organizationId = context.session.activeOrganizationId;

		if (!organizationId) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"No active organization. Please select an organization.",
			});
		}

		// Validate membership and get role
		const membership = await getOrganizationMembership(
			organizationId,
			context.user.id,
		);

		if (!membership) {
			throw new ORPCError("FORBIDDEN", {
				message: "Not a member of this organization",
			});
		}

		return await next({
			context: {
				...context,
				organizationId,
				membership: {
					id: membership.id,
					role: membership.role,
					organization: membership.organization,
				},
			},
		});
	},
);
