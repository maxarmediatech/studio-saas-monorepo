import { ORPCError, os } from "@orpc/server";
import { auth } from "@repo/auth";
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
				session: session.session,
				user: session.user,
			},
		});
	},
);

export const adminProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		if (context.user.role !== "admin") {
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
 * All studio domain procedures MUST use this instead of protectedProcedure.
 */
export const studioProtectedProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		const organizationId = context.session.activeOrganizationId;

		if (!organizationId) {
			throw new ORPCError("FORBIDDEN", {
				message: "No active organization. Please select an organization.",
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
