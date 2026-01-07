import { getActiveOrganization } from "@saas/auth/lib/server";
import { PaymentsTable } from "@saas/studio/components/payments";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Payments | ${organization?.name ?? "Studio"}`,
	};
}

export default async function PaymentsPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<PaymentsTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
		/>
	);
}
