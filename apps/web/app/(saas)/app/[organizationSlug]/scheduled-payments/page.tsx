import { getActiveOrganization } from "@saas/auth/lib/server";
import { SchedulesTable } from "@saas/studio/components/schedules";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Scheduled Payments | ${organization?.name ?? "Studio"}`,
	};
}

export default async function ScheduledPaymentsPage({
	params,
	searchParams,
}: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<SchedulesTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
		/>
	);
}
