"use client";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@repo/ui/components/empty";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/ui/components/tabs";
import { PageContent } from "@saas/studio";
import { useStudioCapabilities } from "@saas/studio/components/studio-capabilities-context";
import { quotesApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";
import { useMemo } from "react";
import { QuotationBlueprintSection } from "./detail/QuotationBlueprintSection";
import {
	DetailMetric,
	formatQuoteDate,
	QuoteStatusBadge,
} from "./detail/QuotationDetailShared";
import { QuotationLifecycleActions } from "./detail/QuotationLifecycleActions";
import { QuotationOptionsSection } from "./detail/QuotationOptionsSection";
import {
	QuotationHistory,
	QuotationTerms,
} from "./detail/QuotationTermsHistory";
import type { QuotePresentationCapabilities } from "./quotation-helpers";

export function QuotationDetail({
	organizationSlug,
	quoteId,
}: {
	organizationSlug: string;
	quoteId: string;
}) {
	const caps = useStudioCapabilities();
	const query = useQuery(quotesApi.getOptions(quoteId));
	const capabilities = useMemo<QuotePresentationCapabilities>(
		() => ({
			readOperational: caps.quoteReadOperational,
			create: caps.quoteCreate,
			update: caps.quoteUpdate,
			send: caps.quoteSend,
			revise: caps.quoteRevise,
			accept: caps.quoteAccept,
			decline: caps.quoteDecline,
			expire: caps.quoteExpire,
			convert: caps.quoteConvert,
		}),
		[caps],
	);
	const quote = query.data?.data;

	if (query.isLoading) {
		return <DetailSkeleton organizationSlug={organizationSlug} />;
	}
	if (query.isError || !quote) {
		return (
			<PageContent
				title="Quotation unavailable"
				backHref={`/app/${organizationSlug}/quotations`}
			>
				<Empty className="min-h-80 border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<AlertCircleIcon />
						</EmptyMedia>
						<EmptyTitle>Could not load quotation</EmptyTitle>
						<EmptyDescription>
							{query.error?.message ??
								"This quotation was not found."}
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button
							type="button"
							variant="outline"
							onClick={() => query.refetch()}
						>
							Try again
						</Button>
					</EmptyContent>
				</Empty>
			</PageContent>
		);
	}

	const expiryDue = Boolean(
		quote.expiresAt && new Date(quote.expiresAt).getTime() <= Date.now(),
	);
	return (
		<PageContent
			title={
				<span className="flex flex-wrap items-center gap-2">
					{quote.title}
					<QuoteStatusBadge status={quote.status} />
				</span>
			}
			backHref={`/app/${organizationSlug}/quotations`}
			controls={
				<QuotationLifecycleActions
					quote={quote}
					capabilities={capabilities}
					organizationSlug={organizationSlug}
				/>
			}
		>
			<div className="flex flex-col gap-8">
				<section className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 xl:grid-cols-4">
					<DetailMetric
						label="Quotation"
						value={quote.quoteNumber}
						hint={`Version ${quote.version}`}
					/>
					<DetailMetric
						label="Client"
						value={quote.primaryClient?.name ?? "—"}
						hint={`${quote.participants.length} participant${quote.participants.length === 1 ? "" : "s"}`}
					/>
					<DetailMetric
						label="Options"
						value={String(quote.optionCount)}
						hint={
							quote.acceptance
								? "Option accepted"
								: "Awaiting selection"
						}
					/>
					<DetailMetric
						label="Expiry"
						value={
							quote.expiresAt
								? formatQuoteDate(quote.expiresAt)
								: "No expiry"
						}
						hint={
							expiryDue && quote.status === "sent"
								? "Due for explicit expiry"
								: undefined
						}
					/>
				</section>
				{quote.convertedBooking?.deletedAt ? (
					<Alert>
						<AlertCircleIcon />
						<AlertTitle>Linked booking was deleted</AlertTitle>
						<AlertDescription>
							{quote.convertedBooking.referenceNumber} remains the
							durable conversion result. Re-conversion is
							intentionally blocked.
						</AlertDescription>
					</Alert>
				) : null}
				<Tabs defaultValue="options">
					<TabsList className="w-full justify-start overflow-x-auto">
						<TabsTrigger value="options">Options</TabsTrigger>
						<TabsTrigger value="blueprint">
							Booking blueprint
						</TabsTrigger>
						<TabsTrigger value="terms">Terms & notes</TabsTrigger>
						<TabsTrigger value="history">History</TabsTrigger>
					</TabsList>
					<TabsContent value="options" className="mt-6">
						<QuotationOptionsSection quote={quote} />
					</TabsContent>
					<TabsContent value="blueprint" className="mt-6">
						<QuotationBlueprintSection quote={quote} />
					</TabsContent>
					<TabsContent value="terms" className="mt-6">
						<QuotationTerms quote={quote} />
					</TabsContent>
					<TabsContent value="history" className="mt-6">
						<QuotationHistory quote={quote} />
					</TabsContent>
				</Tabs>
			</div>
		</PageContent>
	);
}

function DetailSkeleton({ organizationSlug }: { organizationSlug: string }) {
	return (
		<PageContent
			title="Loading quotation…"
			backHref={`/app/${organizationSlug}/quotations`}
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
