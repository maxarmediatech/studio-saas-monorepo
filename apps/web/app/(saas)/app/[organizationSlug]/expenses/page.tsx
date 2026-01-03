import { getActiveOrganization } from "@saas/auth/lib/server";
import { PageContent } from "@saas/studio";
import { ExpensesTable } from "@saas/studio/components/expenses";
import { notFound } from "next/navigation";

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
		<PageContent title="Expenses">
			<ExpensesTable
				organizationSlug={organizationSlug}
				searchParams={searchParams}
			/>
		</PageContent>
	);
}
