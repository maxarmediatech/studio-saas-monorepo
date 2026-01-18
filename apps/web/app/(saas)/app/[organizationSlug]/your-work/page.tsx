import { getActiveOrganization } from "@saas/auth/lib/server";
import { YourWorkView } from "@saas/studio/components/your-work";
import { notFound } from "next/navigation";

const ENTITY_OPTIONS = ["all", "shoot", "task", "deliverable"] as const;
const VIEW_OPTIONS = ["grouped", "table"] as const;

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	return {
		title: `Your Work | ${organization?.name ?? "Studio"}`,
	};
}

export default async function YourWorkPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;
	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	const resolvedSearchParams = await searchParams;
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
