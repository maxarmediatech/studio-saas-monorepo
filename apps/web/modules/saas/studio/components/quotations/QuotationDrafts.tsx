"use client";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useStudioCapabilities } from "@saas/studio/components/studio-capabilities-context";
import { quotesApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { FilePenLineIcon } from "lucide-react";
import Link from "next/link";

export function QuotationDrafts({
	organizationSlug,
}: {
	organizationSlug: string;
}) {
	const caps = useStudioCapabilities();
	const drafts = useQuery({
		...quotesApi.listOptions({
			statuses: ["draft"],
			documentVersion: 1,
			includeDeleted: false,
			page: 1,
			limit: 20,
			sortBy: "updatedAt",
			sortDirection: "desc",
		}),
		enabled: caps.quoteReadOperational && caps.quoteUpdate,
	});

	if (!caps.quoteReadOperational || !caps.quoteUpdate) {
		return null;
	}
	if (drafts.isLoading) {
		return <Skeleton className="h-24 w-full" aria-label="Loading drafts" />;
	}
	if (drafts.isError || !drafts.data?.data.length) {
		return null;
	}

	return (
		<section
			aria-labelledby="quotation-drafts-heading"
			className="space-y-3"
		>
			<div>
				<h2
					id="quotation-drafts-heading"
					className="font-semibold text-lg"
				>
					Drafts
				</h2>
				<p className="text-muted-foreground text-sm">
					Work in progress. Drafts open directly in the editor and are
					not issued quotations.
				</p>
			</div>
			<div className="grid gap-2 sm:grid-cols-2">
				{drafts.data.data.map((draft) => (
					<article
						className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 p-3"
						key={draft.id}
					>
						<div className="flex min-w-0 items-center gap-3">
							<FilePenLineIcon className="size-4 shrink-0 text-muted-foreground" />
							<div className="min-w-0">
								<p className="truncate font-medium">
									{draft.title || "Untitled quotation"}
								</p>
								<p className="text-muted-foreground text-xs">
									Edited{" "}
									{new Intl.DateTimeFormat("en-IN", {
										dateStyle: "medium",
										timeZone: "UTC",
									}).format(new Date(draft.updatedAt))}
								</p>
							</div>
						</div>
						<Button asChild size="sm" variant="outline">
							<Link
								href={`/app/${organizationSlug}/quotations/${draft.id}/edit`}
							>
								Continue
							</Link>
						</Button>
					</article>
				))}
			</div>
		</section>
	);
}
