import { getActiveOrganization } from "@saas/auth/lib/server";
import { TasksTable } from "@saas/studio/components/tasks";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Tasks | ${organization?.name ?? "Studio"}`,
	};
}

export default async function TasksPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<TasksTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
		/>
	);
}
