import {
	ExpensesFilters,
	ExpensesTableSkeleton,
} from "@saas/studio/components/expenses";
import { ExpensesTable } from "@saas/studio/components/expenses/index.server";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Expenses");
}

export default function ExpensesPage({ params, searchParams }: Props) {
	return (
		<div className="space-y-4" data-route-content="expenses">
			<ExpensesFilters />

			<Suspense fallback={<ExpensesTableSkeleton />}>
				<ExpensesContent params={params} searchParams={searchParams} />
			</Suspense>
		</div>
	);
}

async function ExpensesContent({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	return (
		<ExpensesTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
		/>
	);
}
