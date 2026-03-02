import { getActiveOrganization } from "@saas/auth/lib/server";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { notFound } from "next/navigation";
import { RolesPageClient } from "./roles-page-client";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Roles | ${organization?.name ?? "Studio"}`,
	};
}

export default async function RolesSettingsPage({ params }: Props) {
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"roles",
	);

	if (!context) {
		return notFound();
	}

	return (
		<div className="px-4 pb-8 lg:px-6">
			<RolesPageClient canManage />
		</div>
	);
}
