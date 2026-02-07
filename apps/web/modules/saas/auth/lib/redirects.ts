import { config } from "@repo/config";

type OrganizationSummary = {
	id: string;
	slug: string;
};

export function getActiveOrganizationSlug({
	organizations,
	activeOrganizationId,
}: {
	organizations: OrganizationSummary[];
	activeOrganizationId: string | null | undefined;
}): string | null {
	const activeOrganization =
		organizations.find((organization) => {
			return organization.id === activeOrganizationId;
		}) ?? organizations.at(0);

	return activeOrganization?.slug ?? null;
}

export function resolveAppRedirectPath(
	path: string,
	activeOrganizationSlug?: string | null,
): string {
	if (path !== "/app" && path !== "/app/") {
		return path;
	}

	if (activeOrganizationSlug) {
		return `/app/${activeOrganizationSlug}/home`;
	}

	if (
		config.organizations.enable &&
		config.organizations.requireOrganization
	) {
		return `/new-organization?redirectTo=${encodeURIComponent("/app")}`;
	}

	return "/app";
}
