import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
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
	const session = await getSession();
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const isAdmin = isOrganizationAdmin(organization, session?.user);
	if (!isAdmin) {
		return notFound();
	}

	return (
		<div className="px-4 pt-6 pb-8 lg:px-6">
			<RolesPageClient canManage={isAdmin} />
		</div>
	);
}
