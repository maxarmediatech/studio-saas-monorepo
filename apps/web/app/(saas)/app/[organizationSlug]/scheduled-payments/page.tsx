import { Skeleton } from "@repo/ui/components/skeleton";
import { SchedulesTable } from "@saas/studio/components/schedules";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";
import { Suspense } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Scheduled Payments");
}

export default function ScheduledPaymentsPage({ params, searchParams }: Props) {
	return (
		<Suspense
			fallback={
				<div className="space-y-4" aria-hidden="true">
					<Skeleton className="h-10 w-full max-w-xl" />
					<Skeleton className="h-64 w-full" />
				</div>
			}
		>
			<ScheduledPaymentsContent
				params={params}
				searchParams={searchParams}
			/>
		</Suspense>
	);
}

async function ScheduledPaymentsContent({ params, searchParams }: Props) {
	const { organizationSlug } = await params;

	return (
		<SchedulesTable
			organizationSlug={organizationSlug}
			searchParams={searchParams}
		/>
	);
}
