import "server-only";

import type { Metadata } from "next";

type OrganizationParams = Promise<{ organizationSlug: string }>;

export function getOrganizationPageMetadata(
	_params: OrganizationParams,
	title: string,
): Metadata {
	return { title };
}
