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
import { useStudioCapabilities } from "@saas/studio/components/studio-capabilities-context";
import { clientsApi, quotesApi, quotesMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, FileTextIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { QuotationFilters } from "./list/QuotationFilters";
import { QuotationRows } from "./list/QuotationRows";
import {
	type SummaryAction,
	SummaryActionDialog,
} from "./list/SummaryActionDialog";
import { QuotationDrafts } from "./QuotationDrafts";
import {
	getQuoteActions,
	normalizeQuotationListParams,
	type QuotePresentationCapabilities,
	type QuoteSortDirection,
	type QuoteSortField,
} from "./quotation-helpers";

const PAGE_SIZE = 10;

export function QuotationsList({
	organizationSlug,
}: {
	organizationSlug: string;
}) {
	const caps = useStudioCapabilities();
	const canCreateDraft =
		caps.quoteCreate && caps.quoteReadOperational && caps.quoteUpdate;
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const queryClient = useQueryClient();
	const normalized = normalizeQuotationListParams(searchParams);
	const urlSearch = searchParams.get("search")?.trim().slice(0, 255) ?? "";
	const [search, setSearch] = useState(urlSearch);
	const deferredSearch = useDeferredValue(search.trim().slice(0, 255));
	const [pending, setPending] = useState<SummaryAction | null>(null);

	const setParams = (updates: Record<string, string | null>) => {
		const next = new URLSearchParams(searchParams.toString());
		for (const [key, value] of Object.entries(updates)) {
			if (value) {
				next.set(key, value);
			} else {
				next.delete(key);
			}
		}
		const queryString = next.toString();
		router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
			scroll: false,
		});
	};

	useEffect(() => {
		const id = window.setTimeout(() => {
			const current =
				searchParams.get("search")?.trim().slice(0, 255) ?? "";
			if (current !== deferredSearch) {
				setParams({ search: deferredSearch || null, page: null });
			}
		}, 250);
		return () => window.clearTimeout(id);
	}, [deferredSearch, searchParams]);

	useEffect(() => {
		setSearch(urlSearch);
	}, [urlSearch]);

	const query = useQuery(
		quotesApi.listOptions({
			page: normalized.page,
			limit: PAGE_SIZE,
			search: urlSearch || undefined,
			statuses:
				normalized.status === "all" ? undefined : [normalized.status],
			clientId:
				!caps.clientList || normalized.clientId === "all"
					? undefined
					: normalized.clientId,
			includeDeleted: false,
			sortBy: normalized.sortBy,
			sortDirection: normalized.sortDirection,
		}),
	);
	const clients = useQuery({
		...clientsApi.listOptions({
			limit: 100,
			sortBy: "name",
			sortDirection: "asc",
		}),
		enabled: caps.clientList,
	});
	useEffect(() => {
		const pageCount = query.data?.pagination.pageCount ?? 0;
		const lastPage = Math.max(1, pageCount);
		if (normalized.page > lastPage) {
			setParams({ page: lastPage === 1 ? null : String(lastPage) });
		}
	}, [normalized.page, query.data?.pagination.pageCount, searchParams]);
	const sendMutation = useMutation(quotesMutations.send());
	const reviseMutation = useMutation(quotesMutations.revise());
	const mutationPending = sendMutation.isPending || reviseMutation.isPending;

	const presentationCaps = useMemo<QuotePresentationCapabilities>(
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

	const runSummaryAction = async () => {
		if (!pending) {
			return;
		}
		try {
			if (pending.action === "send") {
				await sendMutation.mutateAsync({ id: pending.quote.id });
				toast.success("Quotation sent");
			} else {
				const result = await reviseMutation.mutateAsync({
					id: pending.quote.id,
				});
				toast.success("Revision draft created");
				if (caps.quoteReadOperational) {
					router.push(
						`/app/${organizationSlug}/quotations/${result.data.id}/edit`,
					);
				}
			}
			setPending(null);
			await queryClient.invalidateQueries({
				queryKey: orpc.quotes.key(),
			});
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Quotation action failed",
			);
		}
	};

	if (query.isLoading || (caps.clientList && clients.isLoading)) {
		return <QuotationListSkeleton />;
	}
	if (query.isError) {
		const loadError = query.error;
		return (
			<Alert variant="destructive">
				<AlertCircleIcon />
				<AlertTitle>Could not load quotations</AlertTitle>
				<AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
					{loadError instanceof Error
						? loadError.message
						: "Required quotation data could not be loaded."}
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => {
							void query.refetch();
							if (caps.clientList) {
								void clients.refetch();
							}
						}}
					>
						Try again
					</Button>
				</AlertDescription>
			</Alert>
		);
	}

	const rows = query.data?.data ?? [];
	const pagination = query.data?.pagination;
	const hasFilters = Boolean(
		urlSearch ||
			normalized.status !== "all" ||
			(caps.clientList && normalized.clientId !== "all"),
	);
	const rowProps = rows.map((quote) => ({
		quote,
		organizationSlug,
		canOpen: caps.quoteReadOperational,
		actions: getQuoteActions(quote, presentationCaps),
		onAction: (action: "send" | "revise") => setPending({ quote, action }),
	}));

	const updateSort = (
		sortBy: QuoteSortField,
		direction: QuoteSortDirection,
	) =>
		setParams({
			sort: `${sortBy}:${direction}`,
			sortBy: null,
			direction: null,
			page: null,
		});

	return (
		<div className="flex flex-col gap-6">
			<QuotationDrafts organizationSlug={organizationSlug} />
			<section
				aria-labelledby="issued-quotations-heading"
				className="flex flex-col gap-4"
			>
				<div>
					<h2
						id="issued-quotations-heading"
						className="font-semibold text-lg"
					>
						Issued quotations
					</h2>
					<p className="text-muted-foreground text-sm">
						Sent quotations and their outcomes.
					</p>
				</div>
				<QuotationFilters
					search={search}
					status={normalized.status}
					clientId={normalized.clientId}
					sortBy={normalized.sortBy}
					sortDirection={normalized.sortDirection}
					clients={clients.data?.data ?? []}
					canFilterClients={caps.clientList && !clients.isError}
					onSearch={setSearch}
					onStatus={(value) =>
						setParams({
							status: value === "all" ? null : value,
							page: null,
						})
					}
					onClient={(value) =>
						setParams({
							client: value === "all" ? null : value,
							page: null,
						})
					}
					onSort={updateSort}
				/>
				{rows.length === 0 ? (
					<Empty className="min-h-80 border">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<FileTextIcon />
							</EmptyMedia>
							<EmptyTitle>
								{hasFilters
									? "No matching quotations"
									: "No issued quotations yet"}
							</EmptyTitle>
							<EmptyDescription>
								{hasFilters
									? "Clear or adjust filters to broaden the results."
									: "Build a priced proposal and carry its booking plan through conversion."}
							</EmptyDescription>
						</EmptyHeader>
						<EmptyContent>
							{hasFilters ? (
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setSearch("");
										router.replace(pathname);
									}}
								>
									Clear filters
								</Button>
							) : canCreateDraft ? (
								<Button asChild>
									<Link
										href={`/app/${organizationSlug}/quotations/new`}
									>
										<PlusIcon data-icon="inline-start" />
										Create quotation
									</Link>
								</Button>
							) : null}
						</EmptyContent>
					</Empty>
				) : (
					<>
						<QuotationRows rows={rowProps} />
						<div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
							<span>
								{pagination?.total ?? rows.length} quotations
							</span>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									size="sm"
									variant="outline"
									disabled={
										normalized.page <= 1 || query.isFetching
									}
									onClick={() =>
										setParams({
											page: String(normalized.page - 1),
										})
									}
								>
									Previous
								</Button>
								<span className="tabular-nums">
									{normalized.page} /{" "}
									{Math.max(1, pagination?.pageCount ?? 1)}
								</span>
								<Button
									type="button"
									size="sm"
									variant="outline"
									disabled={
										normalized.page >=
											(pagination?.pageCount ?? 1) ||
										query.isFetching
									}
									onClick={() =>
										setParams({
											page: String(normalized.page + 1),
										})
									}
								>
									Next
								</Button>
							</div>
						</div>
					</>
				)}
			</section>
			<SummaryActionDialog
				pending={pending}
				mutationPending={mutationPending}
				onOpenChange={(open) => {
					if (!open) {
						setPending(null);
					}
				}}
				onConfirm={() => void runSummaryAction()}
			/>
		</div>
	);
}

export function QuotationListSkeleton() {
	return (
		<output className="flex flex-col gap-4" aria-label="Loading quotations">
			<div className="flex flex-col gap-2 sm:flex-row">
				<Skeleton className="h-9 flex-1" />
				<Skeleton className="h-9 w-full sm:w-40" />
				<Skeleton className="h-9 w-full sm:w-48" />
			</div>
			<div className="flex flex-col gap-1 rounded-lg border p-2">
				{Array.from({ length: 7 }, (_, index) => (
					<Skeleton key={index} className="h-14 w-full" />
				))}
			</div>
		</output>
	);
}
