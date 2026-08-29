"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import { PageContent } from "@saas/studio";
import { ReceiptsTableSkeleton } from "@saas/studio/components/receipts/ReceiptsTableSkeleton";
import { StudioListRouteFallback } from "@saas/studio/components/StudioListRouteFallback";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

function useReceiptsRoute() {
	const { organizationSlug } = useParams<{ organizationSlug: string }>();
	const pathname = usePathname();
	const baseRoute = `/app/${organizationSlug}/receipts`;
	const isDetailPage =
		pathname !== baseRoute && pathname.startsWith(`${baseRoute}/`);

	return { isDetailPage, organizationSlug };
}

export function ReceiptsLayoutClient({ children }: Props) {
	const { isDetailPage } = useReceiptsRoute();

	if (isDetailPage) {
		return <>{children}</>;
	}

	return <PageContent title="Receipts">{children}</PageContent>;
}

export function ReceiptsLayoutFallback() {
	const { isDetailPage, organizationSlug } = useReceiptsRoute();

	if (isDetailPage) {
		return (
			<PageContent
				title={<Skeleton className="h-5 w-40" />}
				backHref={`/app/${organizationSlug}/receipts`}
			>
				<div className="space-y-6" aria-hidden="true">
					<Skeleton className="h-40 w-full rounded-lg" />
					<div className="grid gap-8 lg:grid-cols-3">
						<Skeleton className="h-80 lg:col-span-2" />
						<Skeleton className="h-56" />
					</div>
				</div>
			</PageContent>
		);
	}

	return (
		<StudioListRouteFallback label="receipts">
			<ReceiptsTableSkeleton />
		</StudioListRouteFallback>
	);
}
