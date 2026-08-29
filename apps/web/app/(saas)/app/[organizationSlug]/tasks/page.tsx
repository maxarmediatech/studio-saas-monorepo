import {
	TasksFilters,
	TasksTableSkeleton,
} from "@saas/studio/components/tasks";
import { TasksTable } from "@saas/studio/components/tasks/index.server";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Tasks");
}

export default function TasksPage({ params, searchParams }: Props) {
	return (
		<div className="space-y-4" data-route-content="tasks">
			<TasksFilters />

			<Suspense fallback={<TasksTableSkeleton />}>
				<TasksContent params={params} searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function TasksContent({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	return (
		<TasksTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
		/>
	);
}
