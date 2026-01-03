import { getActiveOrganization } from "@saas/auth/lib/server";
import { PageContent } from "@saas/studio";
import { CrewsTable } from "@saas/studio/components/crews";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Team | ${organization?.name ?? "Studio"}`,
	};
}

export default async function CrewsPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<PageContent title="Team">
			<CrewsTable
				organizationSlug={organizationSlug}
				searchParams={searchParams}
			/>
		</PageContent>
	);
}
