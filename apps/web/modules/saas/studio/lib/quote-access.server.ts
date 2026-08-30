import "server-only";

import { and, db, desc, eq, isNull, quotes } from "@repo/database";
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
		userId: session.user.id,
		organizationTimezone: organizationSettings?.timezone ?? "UTC",
	};
}

export async function findReusableQuotationDraft(
	organizationId: string,
	userId: string,
) {
	return db.query.quotes.findFirst({
		where: and(
			eq(quotes.organizationId, organizationId),
			eq(quotes.createdBy, userId),
			eq(quotes.status, "draft"),
			eq(quotes.documentVersion, 1),
			isNull(quotes.supersedesQuoteId),
			isNull(quotes.deletedAt),
		),
		columns: { id: true },
		orderBy: [desc(quotes.updatedAt), desc(quotes.id)],
	});
}
