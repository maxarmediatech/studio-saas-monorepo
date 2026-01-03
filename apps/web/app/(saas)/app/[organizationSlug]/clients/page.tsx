import { getActiveOrganization } from "@saas/auth/lib/server";
import { PageContent } from "@saas/studio";
import { ClientsTable } from "@saas/studio/components/clients";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Clients | ${organization?.name ?? "Studio"}`,
	};
}

export default async function ClientsPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<PageContent title="Clients">
			<ClientsTable searchParams={searchParams} />
		</PageContent>
	);
}
