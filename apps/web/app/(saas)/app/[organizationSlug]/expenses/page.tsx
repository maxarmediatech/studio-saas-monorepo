import { getActiveOrganization } from "@saas/auth/lib/server";
import {
	ExpensesFilters,
	ExpensesTableSkeleton,
} from "@saas/studio/components/expenses";
import { ExpensesTable } from "@saas/studio/components/expenses/index.server";
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
		title: `Expenses | ${organization?.name ?? "Studio"}`,
	};
}

export default async function ExpensesPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	const organization = await getActiveOrganization(organizationSlug);

	if (!organization) {
		return notFound();
	}

	return (
		<div className="space-y-4">
			<ExpensesFilters />

			<Suspense fallback={<ExpensesTableSkeleton />}>
				<ExpensesTable
					organizationSlug={organizationSlug}
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
