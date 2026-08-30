"use client";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { PageContent } from "@saas/studio";
import { QuotationListSkeleton } from "@saas/studio/components/quotations/QuotationsList";
import { QuotationWizardSkeleton } from "@saas/studio/components/quotations/QuotationWizardSkeleton";
import { StudioListRouteFallback } from "@saas/studio/components/StudioListRouteFallback";
import { useStudioCapabilities } from "@saas/studio/components/studio-capabilities-context";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

type QuotationsRouteKind = "detail" | "edit" | "list" | "new";

function useQuotationsRoute() {
	const { organizationSlug } = useParams<{ organizationSlug: string }>();
	const pathname = usePathname();
	const baseRoute = `/app/${organizationSlug}/quotations`;
	let kind: QuotationsRouteKind = "list";

	if (pathname === `${baseRoute}/new`) {
		kind = "new";
	} else if (pathname.endsWith("/edit")) {
		kind = "edit";
	} else if (pathname.startsWith(`${baseRoute}/`)) {
		kind = "detail";
	}

	return { baseRoute, kind };
}

export function QuotationsLayoutClient({ children }: Props) {
	const { baseRoute, kind } = useQuotationsRoute();
	const { quoteCreate, quoteReadOperational, quoteUpdate } =
		useStudioCapabilities();
	const canCreateDraft = quoteCreate && quoteReadOperational && quoteUpdate;

	if (kind !== "list") {
		return <>{children}</>;
	}

	return (
		<PageContent
			title="Quotations"
			controls={
				canCreateDraft ? (
					<Button asChild size="sm">
						<Link href={`${baseRoute}/new`}>
							<PlusIcon data-icon="inline-start" />
							New quotation
						</Link>
					</Button>
				) : undefined
			}
		>
			{children}
		</PageContent>
	);
}

export function QuotationsLayoutFallback() {
	const { baseRoute, kind } = useQuotationsRoute();

	if (kind === "new" || kind === "edit") {
		return <QuotationWizardSkeleton />;
	}

	if (kind === "detail") {
		return (
			<PageContent
				title={<Skeleton className="h-6 w-52" aria-hidden="true" />}
				backHref={baseRoute}
			>
				<output
					className="flex flex-col gap-6"
					aria-label="Loading quotation detail"
				>
					<Skeleton className="h-28" />
					<Skeleton className="h-10 w-full max-w-96" />
					<Skeleton className="h-80" />
				</output>
			</PageContent>
		);
	}

	return (
		<StudioListRouteFallback label="quotations">
			<QuotationListSkeleton />
		</StudioListRouteFallback>
	);
}
