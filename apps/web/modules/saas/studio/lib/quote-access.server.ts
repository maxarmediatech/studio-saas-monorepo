import "server-only";

import { db } from "@repo/database";
import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { resolveStudioAccess } from "./resolve-studio-access.server";

export async function resolveQuoteRouteAccess(organizationSlug: string) {
	const [organization, session] = await Promise.all([
		getActiveOrganization(organizationSlug),
		getSession(),
	]);
	if (!organization || !session) {
		return null;
	}
	const [access, organizationSettings] = await Promise.all([
		resolveStudioAccess(organization, session),
		db.query.organizations.findFirst({
			where: (organizations, { eq }) =>
				eq(organizations.id, organization.id),
			columns: { timezone: true },
		}),
	]);
	return {
		...access,
		organization,
		organizationTimezone: organizationSettings?.timezone ?? "UTC",
	};
}
