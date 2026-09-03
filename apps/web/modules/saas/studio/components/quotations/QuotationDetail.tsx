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
import { AlertCircleIcon, FileTextIcon, Loader2Icon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
import { QuotationPdfPreview } from "./QuotationPdfPreview";
import {
	type QuotationPresentationState,
	QuotationTemplateSelector,
} from "./QuotationTemplateSelector";
import { authoritativeQuotationQuery } from "./quotation-authoritative-query";
import type { QuotePresentationCapabilities } from "./quotation-helpers";
import {
	buildQuotationPdfUrl,
	type QuotationPresentationIdentity,
} from "./quotation-pdf-route";

export function QuotationDetail({
	organizationSlug,
	quoteId,
}: {
	organizationSlug: string;
	quoteId: string;
}) {
	const caps = useStudioCapabilities();
	const renderIntentStatusRef = useRef<string | null>(null);
	const [availablePreviewIdentity, setAvailablePreviewIdentity] =
		useState<QuotationPresentationIdentity | null>(null);
	const query = useQuery({
		...quotesApi.getOptions(quoteId),
		refetchInterval: (current) =>
			current.state.data?.data.status === "preparing" &&
			renderIntentStatusRef.current !== "failed"
				? 3_000
				: false,
	});
	const presentationQuery = useQuery({
		...authoritativeQuotationQuery(
			quotesApi.getPresentationOptions(quoteId),
		),
		enabled:
			caps.quoteReadOperational && query.data?.data.documentVersion === 1,
		refetchInterval: (current) => {
			const status = current.state.data?.data.renderIntent?.status;
			return status === "pending" || status === "rendering"
				? 3_000
				: false;
		},
	});
	const presentation =
		(presentationQuery.data?.data as
			| QuotationPresentationState
			| undefined) ?? null;
	renderIntentStatusRef.current = presentation?.renderIntent?.status ?? null;
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
	const previewIdentity =
		quote.status === "draft" ? availablePreviewIdentity : presentation;
	const pdfUrl = previewIdentity
		? buildQuotationPdfUrl(quote.id, previewIdentity)
		: null;
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
					presentation={presentation}
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
				<Tabs
					defaultValue={
						quote.documentVersion === 1 ? "document" : "options"
					}
				>
					<TabsList className="w-full justify-start overflow-x-auto">
						{quote.documentVersion === 1 ? (
							<TabsTrigger value="document">Document</TabsTrigger>
						) : null}
						<TabsTrigger value="options">Options</TabsTrigger>
						<TabsTrigger value="blueprint">
							Booking blueprint
						</TabsTrigger>
						<TabsTrigger value="terms">Terms & notes</TabsTrigger>
						<TabsTrigger value="history">History</TabsTrigger>
					</TabsList>
					{quote.documentVersion === 1 ? (
						<TabsContent
							value="document"
							className="mt-6 space-y-4"
						>
							<div className="rounded-lg border p-4">
								<QuotationTemplateSelector
									canRead={caps.quoteReadOperational}
									canSelect={
										quote.status === "draft" &&
										caps.quoteUpdate
									}
									expectedDocumentRevision={
										quote.documentRevision
									}
									historical={
										quote.status !== "draft" &&
										quote.status !== "preparing"
									}
									preparing={quote.status === "preparing"}
									onPreviewIdentityChange={
										setAvailablePreviewIdentity
									}
									quoteId={quote.id}
								/>
							</div>
							{pdfUrl && quote.status !== "preparing" ? (
								<div className="flex justify-end">
									<Button asChild variant="outline">
										<a href={`${pdfUrl}&download=1`}>
											Download PDF
										</a>
									</Button>
								</div>
							) : null}
							{quote.status === "preparing" ? (
								<div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
									{presentation?.renderIntent?.status ===
									"failed" ? (
										<FileTextIcon className="size-8 text-destructive" />
									) : (
										<Loader2Icon className="size-8 animate-spin text-muted-foreground" />
									)}
									<p className="font-medium">
										{presentation?.renderIntent?.status ===
										"failed"
											? "PDF preparation failed"
											: "Preparing immutable PDF"}
									</p>
									{presentation?.renderIntent
										?.lastErrorMessage ? (
										<p className="max-w-lg text-sm text-muted-foreground">
											{
												presentation.renderIntent
													.lastErrorMessage
											}
										</p>
									) : null}
								</div>
							) : previewIdentity ? (
								<QuotationPdfPreview
									className="h-[75dvh] min-h-[640px]"
									identity={previewIdentity}
									quoteId={quote.id}
								/>
							) : (
								<div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
									An available template is required for draft
									preview.
								</div>
							)}
						</TabsContent>
					) : null}
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
