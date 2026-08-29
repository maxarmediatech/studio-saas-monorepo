import { Skeleton } from "@repo/ui/components/skeleton";
import { YourWorkView } from "@saas/studio/components/your-work";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

const ENTITY_OPTIONS = ["all", "shoot", "task", "deliverable"] as const;
const VIEW_OPTIONS = ["grouped", "table"] as const;

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Your Work");
}

export default function YourWorkPage({ params, searchParams }: Props) {
	return (
		<Suspense
			fallback={
				<div className="space-y-4" aria-hidden="true">
					<Skeleton className="h-10 w-full max-w-xl" />
					<Skeleton className="h-64 w-full" />
				</div>
			}
		>
			<YourWorkContent params={params} searchParams={searchParams} />
		</Suspense>
	);
}

async function YourWorkContent({ params, searchParams }: Props) {
	const [{ organizationSlug }, resolvedSearchParams] = await Promise.all([
		params,
		searchParams,
	]);
	const entityTypeParam =
		typeof resolvedSearchParams.entityType === "string"
			? resolvedSearchParams.entityType
			: "all";
	const viewParam =
		typeof resolvedSearchParams.view === "string"
			? resolvedSearchParams.view
			: "grouped";

	const entityType = ENTITY_OPTIONS.includes(
		entityTypeParam as (typeof ENTITY_OPTIONS)[number],
	)
		? (entityTypeParam as (typeof ENTITY_OPTIONS)[number])
		: "all";
	const view = VIEW_OPTIONS.includes(
		viewParam as (typeof VIEW_OPTIONS)[number],
	)
		? (viewParam as (typeof VIEW_OPTIONS)[number])
		: "grouped";

	return (
		<YourWorkView
			organizationSlug={organizationSlug}
			initialFilters={{ entityType, view }}
		/>
	);
}
