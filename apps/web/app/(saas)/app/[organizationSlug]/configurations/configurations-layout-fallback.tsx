"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import { PageContent } from "@saas/studio";
import { ConfigurationsTableSkeleton } from "@saas/studio/components/configurations";
import { usePathname } from "next/navigation";

const CONFIGURATION_TITLES: Record<string, string> = {
	"booking-types": "Booking Types",
	"event-types": "Event Types",
	"package-types": "Package Types",
	"relation-types": "Relation Types",
	specialisations: "Specialisations",
};

export function ConfigurationsLayoutFallback() {
	const pathname = usePathname();
	const segment = pathname.split("/").filter(Boolean).at(-1) ?? "";
	const title = CONFIGURATION_TITLES[segment] ?? "Configurations";

	return (
		<PageContent
			title={title}
			controls={<Skeleton className="h-9 w-28" aria-hidden="true" />}
		>
			<div className="space-y-4" aria-hidden="true">
				<Skeleton className="h-10 w-full max-w-xl" />
				<ConfigurationsTableSkeleton />
			</div>
		</PageContent>
	);
}
