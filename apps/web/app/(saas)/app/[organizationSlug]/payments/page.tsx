import { getActiveOrganization } from "@saas/auth/lib/server";
import {
	PaymentsFilters,
	PaymentsTableSkeleton,
} from "@saas/studio/components/payments";
import { PaymentsTable } from "@saas/studio/components/payments/index.server";
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
		<div className="space-y-4">
			<PaymentsFilters />

			<Suspense fallback={<PaymentsTableSkeleton />}>
				<PaymentsTable
					organizationSlug={organizationSlug}
					searchParams={searchParams}
				/>
			</Suspense>
		</div>
	);
}
