import { getActiveOrganization } from "@saas/auth/lib/server";
import { PageContent } from "@saas/studio";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Billing | ${organization?.name ?? "Studio"}`,
	};
}

export default async function BillingSettingsPage({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<PageContent title="Billing">
			<div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
				<h3 className="text-lg font-medium text-neutral-900">
					Billing Settings
				</h3>
				<p className="mt-2 text-sm text-neutral-500">
					Manage your subscription, payment methods, and billing history.
				</p>
				<p className="mt-4 text-sm text-neutral-400">Coming soon</p>
			</div>
		</PageContent>
	);
}
