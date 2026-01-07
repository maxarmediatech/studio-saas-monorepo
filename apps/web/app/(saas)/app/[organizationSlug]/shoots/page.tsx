import { getActiveOrganization } from "@saas/auth/lib/server";
import { ShootsTable } from "@saas/studio/components/shoots";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Shoots | ${organization?.name ?? "Studio"}`,
	};
}

export default async function ShootsPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<ShootsTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
		/>
	);
}
