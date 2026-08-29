"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import { PageContent } from "@saas/studio";
import { InvoicesTableSkeleton } from "@saas/studio/components/invoices/InvoicesTableSkeleton";
import { StudioListRouteFallback } from "@saas/studio/components/StudioListRouteFallback";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

function useInvoicesRoute() {
	const { organizationSlug } = useParams<{ organizationSlug: string }>();
	const pathname = usePathname();
	const baseRoute = `/app/${organizationSlug}/invoices`;
	const isDetailPage =
		pathname !== baseRoute && pathname.startsWith(`${baseRoute}/`);

	return { isDetailPage, organizationSlug };
}

export function InvoicesLayoutClient({ children }: Props) {
	const { isDetailPage } = useInvoicesRoute();

	if (isDetailPage) {
		return <>{children}</>;
	}

	return <PageContent title="Invoices">{children}</PageContent>;
}

export function InvoicesLayoutFallback() {
	const { isDetailPage, organizationSlug } = useInvoicesRoute();

	if (isDetailPage) {
		return (
			<PageContent
				title={<Skeleton className="h-5 w-40" />}
				backHref={`/app/${organizationSlug}/invoices`}
			>
				<div className="space-y-6" aria-hidden="true">
					<Skeleton className="h-44 w-full rounded-2xl" />
					<div className="grid gap-8 lg:grid-cols-3">
						<Skeleton className="h-96 lg:col-span-2" />
						<Skeleton className="h-64" />
					</div>
				</div>
			</PageContent>
		);
	}

	return (
		<StudioListRouteFallback label="invoices">
			<InvoicesTableSkeleton />
		</StudioListRouteFallback>
	);
}
