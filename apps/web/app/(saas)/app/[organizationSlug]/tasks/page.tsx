import { getActiveOrganization } from "@saas/auth/lib/server";
import {
	TasksFilters,
	TasksTableSkeleton,
} from "@saas/studio/components/tasks";
import { TasksTable } from "@saas/studio/components/tasks/index.server";
import { notFound } from "next/navigation";
import { Suspense } from "react";

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
		<div className="space-y-4">
			<TasksFilters />

			<Suspense fallback={<TasksTableSkeleton />}>
				<TasksTable
					organizationSlug={organizationSlug}
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
