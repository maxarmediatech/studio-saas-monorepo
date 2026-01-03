import { getActiveOrganization } from "@saas/auth/lib/server";
import { PageContent } from "@saas/studio";
import { DeliverablesTable } from "@saas/studio/components/deliverables";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Deliverables | ${organization?.name ?? "Studio"}`,
	};
}

export default async function DeliverablesPage({
	params,
	searchParams,
}: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<PageContent title="Deliverables">
			<DeliverablesTable
				organizationSlug={organizationSlug}
				searchParams={searchParams}
			/>
		</PageContent>
	);
}
