import { getActiveOrganization } from "@saas/auth/lib/server";
import { OrganizationLogo } from "@saas/organizations/components/OrganizationLogo";
import { PageContent } from "@saas/studio";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `General | ${organization?.name ?? "Studio"}`,
	};
}

export default async function GeneralSettingsPage({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<PageContent title="General">
			<div className="space-y-8">
				{/* Organization Info */}
				<div className="rounded-lg border border-neutral-200 p-6">
					<h3 className="text-base font-medium text-neutral-900 mb-4">
						Studio Information
					</h3>
					<div className="flex items-center gap-4">
						<OrganizationLogo
							name={organization.name}
							logoUrl={organization.logo}
							className="size-16 rounded-lg"
						/>
						<div>
							<p className="font-medium text-neutral-900">
								{organization.name}
							</p>
							<p className="text-sm text-neutral-500">
								/{organization.slug}
							</p>
						</div>
					</div>
				</div>

				{/* Placeholder for edit form */}
				<div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
					<h3 className="text-lg font-medium text-neutral-900">
						Edit Studio Settings
					</h3>
					<p className="mt-2 text-sm text-neutral-500">
						Update your studio name, logo, and other details.
					</p>
					<p className="mt-4 text-sm text-neutral-400">Coming soon</p>
				</div>
			</div>
		</PageContent>
	);
}
