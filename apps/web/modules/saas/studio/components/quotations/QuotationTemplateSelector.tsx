"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileWarning, Loader2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { quotesApi, quotesMutations } from "../../lib/api";
import {
	authoritativeQuotationQuery,
	isQuotationPresentationRevisionCurrent,
	quotationPresentationRevisionToRefetch,
} from "./quotation-authoritative-query";
import {
	isQuotationPresentationConflict,
	isQuotationTemplateAvailable,
	type QuotationPresentationIdentity,
} from "./quotation-pdf-route";

export interface QuotationPresentationState
	extends QuotationPresentationIdentity {
	persisted: boolean;
	renderIntent: {
		id: string;
		status:
			| "pending"
			| "rendering"
			| "failed"
			| "returned_to_draft"
			| "completed";
		attemptCount: number;
		lastErrorCode: string | null;
		lastErrorMessage: string | null;
		lastAttemptAt: string | null;
		createdAt: string;
		updatedAt: string;
	} | null;
}

interface QuotationTemplateSelectorProps {
	quoteId: string;
	canRead: boolean;
	canSelect: boolean;
	expectedDocumentRevision?: number;
	historical?: boolean;
	preparing?: boolean;
	onPreviewIdentityChange?: (
		value: QuotationPresentationIdentity | null,
	) => void;
}

function TemplateThumbnail({
	thumbnailPath,
	compact = false,
}: {
	thumbnailPath: string;
	compact?: boolean;
}) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"aspect-[210/297] shrink-0 overflow-hidden rounded-md border bg-white shadow-sm",
				compact ? "w-14" : "w-20",
			)}
		>
			<Image
				alt=""
				className="h-full w-full object-cover object-top"
				height={509}
				src={thumbnailPath}
				width={360}
			/>
		</div>
	);
}

function TemplateSelectorSkeleton() {
	return (
		<output aria-label="Loading quotation templates" className="space-y-3">
			<div className="space-y-2">
				<Skeleton className="h-5 w-32" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				{["first", "second"].map((key) => (
					<div
						className="flex h-32 items-center gap-3 rounded-lg border p-3"
						key={key}
					>
						<Skeleton className="h-24 w-16 shrink-0" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-3 w-full" />
							<Skeleton className="h-3 w-3/4" />
						</div>
					</div>
				))}
			</div>
		</output>
	);
}

export function QuotationTemplateSelector({
	quoteId,
	canRead,
	canSelect,
	expectedDocumentRevision,
	historical = false,
	preparing = false,
	onPreviewIdentityChange,
}: QuotationTemplateSelectorProps) {
	const queryClient = useQueryClient();
	const lastRequestedRevision = useRef<number | null>(null);
	const catalog = useQuery({
		...quotesApi.listTemplatesOptions(),
		enabled: canRead,
	});
	const presentation = useQuery({
		...authoritativeQuotationQuery(
			quotesApi.getPresentationOptions(quoteId),
		),
		enabled: canRead && Boolean(quoteId),
		refetchInterval: (current) => {
			const status = current.state.data?.data.renderIntent?.status;
			return status === "pending" || status === "rendering"
				? 3_000
				: false;
		},
	});
	const selectMutation = useMutation(quotesMutations.selectTemplate());
	const current = presentation.data?.data ?? null;
	const templates = catalog.data?.data ?? [];
	const currentAvailable =
		current !== null && isQuotationTemplateAvailable(templates, current);
	const currentRevision = current?.documentRevision ?? null;
	const revisionCurrent = isQuotationPresentationRevisionCurrent(
		currentRevision,
		expectedDocumentRevision,
	);

	useEffect(() => {
		onPreviewIdentityChange?.(
			currentAvailable && revisionCurrent ? current : null,
		);
	}, [current, currentAvailable, revisionCurrent, onPreviewIdentityChange]);

	useEffect(() => {
		if (current !== null && revisionCurrent) {
			lastRequestedRevision.current = null;
			return;
		}
		const revision = quotationPresentationRevisionToRefetch(
			currentRevision,
			expectedDocumentRevision,
			lastRequestedRevision.current,
		);
		if (revision === null) {
			return;
		}
		lastRequestedRevision.current = revision;
		void presentation.refetch();
	}, [
		current,
		currentRevision,
		expectedDocumentRevision,
		presentation.refetch,
		revisionCurrent,
	]);

	if (!canRead) {
		return (
			<p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
				Quotation template preview requires operational read access.
			</p>
		);
	}

	if (catalog.isPending || presentation.isPending) {
		return <TemplateSelectorSkeleton />;
	}

	if (
		catalog.isError ||
		presentation.isError ||
		presentation.isRefetchError ||
		!current
	) {
		return (
			<div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-4">
				<p className="text-sm text-muted-foreground">
					Template catalog is temporarily unavailable.
				</p>
				<Button
					onClick={() => {
						lastRequestedRevision.current = null;
						catalog.refetch();
						presentation.refetch();
					}}
					size="sm"
					variant="outline"
				>
					Retry
				</Button>
			</div>
		);
	}

	if (!revisionCurrent) {
		return (
			<div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
				<Loader2 className="size-4 animate-spin" /> Refreshing current
				presentation
			</div>
		);
	}

	const select = async (templateId: string, templateVersion: number) => {
		try {
			await selectMutation.mutateAsync({
				id: quoteId,
				templateId,
				templateVersion,
				expectedDocumentRevision: current.documentRevision,
				expectedSelectionVersion: current.selectionVersion,
			});
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey:
						quotesApi.getPresentationOptions(quoteId).queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: quotesApi.getOptions(quoteId).queryKey,
				}),
			]);
			toast.success("Quotation template updated");
		} catch (error) {
			if (isQuotationPresentationConflict(error)) {
				await queryClient.invalidateQueries({
					queryKey: quotesApi.getOptions(quoteId).queryKey,
				});
				await Promise.all([
					presentation.refetch(),
					queryClient.fetchQuery(quotesApi.getOptions(quoteId)),
				]);
				toast.error(
					"Quotation changed elsewhere. Latest template selection loaded.",
				);
				return;
			}
			toast.error(
				error instanceof Error
					? error.message
					: "Could not update quotation template",
			);
		}
	};
	const currentTemplate = templates.find(
		(template) =>
			template.templateId === current.templateId &&
			template.templateVersion === current.templateVersion,
	);
	const readOnly = historical || preparing || !canSelect;
	const readOnlyExplanation = historical
		? current.persisted
			? "This is the final document. Its layout cannot be changed."
			: "This quotation predates template selection. Its existing PDF uses the Classic layout."
		: preparing
			? "Template changes are locked while Stuwiz prepares the final PDF."
			: "You can preview this layout, but your current access cannot change it.";
	const onlyTemplate = templates.length === 1 ? templates[0] : null;

	if (onlyTemplate) {
		if (readOnly) {
			return (
				<div className="flex items-start justify-between gap-3">
					<div>
						<h3 className="font-semibold">
							{historical ? "Final PDF" : "Quotation preview"}
						</h3>
						<p className="text-sm text-muted-foreground">
							{historical
								? "The saved document is shown below."
								: "The final PDF is being prepared."}
						</p>
					</div>
					<Badge variant="outline">
						{preparing
							? "Preparing"
							: historical
								? "Final"
								: "View only"}
					</Badge>
				</div>
			);
		}

		if (currentAvailable) {
			return (
				<div>
					<h3 className="font-semibold">Quotation preview</h3>
					<p className="text-sm text-muted-foreground">
						Review the document below before sending.
					</p>
				</div>
			);
		}

		return (
			<div className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
				<div>
					<p className="font-medium">Update the PDF layout</p>
					<p className="text-sm text-muted-foreground">
						This draft uses an older layout. Update it before
						previewing or sending.
					</p>
				</div>
				<Button
					disabled={selectMutation.isPending}
					onClick={() =>
						select(
							onlyTemplate.templateId,
							onlyTemplate.templateVersion,
						)
					}
					size="sm"
				>
					{selectMutation.isPending ? (
						<Loader2
							aria-hidden="true"
							className="size-4 animate-spin"
						/>
					) : null}
					Update
				</Button>
			</div>
		);
	}

	if (readOnly) {
		return (
			<div className="space-y-3">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h3 className="font-semibold">
							{historical ? "PDF used" : "PDF template"}
						</h3>
						<p className="text-sm text-muted-foreground">
							{historical
								? "The saved document is shown below."
								: "The layout currently attached to this quotation."}
						</p>
					</div>
					<Badge variant="outline">
						{preparing
							? "Preparing"
							: historical
								? "Final"
								: "View only"}
					</Badge>
				</div>
				{currentTemplate ? (
					<div className="flex items-center gap-3 border-t pt-3">
						<TemplateThumbnail
							compact
							thumbnailPath={currentTemplate.thumbnailPath}
						/>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<p className="font-medium">
									{currentTemplate.label}
								</p>
								{!current.persisted ? (
									<Badge variant="secondary">
										Legacy default
									</Badge>
								) : null}
							</div>
							<p className="text-sm text-muted-foreground">
								{currentTemplate.description}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{readOnlyExplanation}
							</p>
						</div>
					</div>
				) : (
					<div className="flex gap-2 border-t pt-3 text-sm">
						<FileWarning
							aria-hidden="true"
							className="mt-0.5 size-4 shrink-0 text-amber-600"
						/>
						<div>
							<p className="font-medium">
								Saved template unavailable: {current.templateId}
								@{current.templateVersion}
							</p>
							<p className="text-muted-foreground">
								The historical PDF remains available below.
							</p>
						</div>
					</div>
				)}
			</div>
		);
	}

	return (
		<div aria-busy={selectMutation.isPending} className="space-y-3">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h3 className="font-semibold">Document style</h3>
					<p className="text-sm text-muted-foreground">
						Choose a layout. Your quotation content stays the same.
					</p>
				</div>
			</div>
			{!currentAvailable && (
				<div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
					<FileWarning className="mt-0.5 size-4 shrink-0 text-amber-600" />
					<div>
						<p className="font-medium">
							Selected template unavailable · {current.templateId}
							@{current.templateVersion}
						</p>
						<p className="text-muted-foreground">
							{historical
								? "It is no longer selectable. The historical PDF remains available."
								: preparing
									? "Selection is locked while PDF preparation is in progress."
									: "Choose an available template before previewing or sending."}
						</p>
					</div>
				</div>
			)}
			<div className="grid gap-3 sm:grid-cols-2">
				{templates.map((template) => {
					const selected =
						template.templateId === current.templateId &&
						template.templateVersion === current.templateVersion;
					return (
						<button
							aria-pressed={selected}
							className={cn(
								"grid min-h-32 grid-cols-[5rem_1fr] items-center gap-3 rounded-lg border p-3 text-left transition-[border-color,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-default",
								selected &&
									"border-foreground bg-muted/30 ring-1 ring-foreground",
								!selected &&
									"hover:border-foreground/40 hover:bg-muted/20",
								selectMutation.isPending &&
									!selected &&
									"opacity-60",
							)}
							disabled={
								!canSelect ||
								selected ||
								selectMutation.isPending
							}
							key={`${template.templateId}@${template.templateVersion}`}
							onClick={() =>
								select(
									template.templateId,
									template.templateVersion,
								)
							}
							type="button"
						>
							<TemplateThumbnail
								thumbnailPath={template.thumbnailPath}
							/>
							<div className="min-w-0">
								<div className="flex items-center justify-between gap-2">
									<span className="font-medium">
										{template.label}
									</span>
									{selected ? (
										<span className="flex items-center gap-1 text-xs font-medium">
											<Check
												aria-hidden="true"
												className="size-3.5"
											/>
											Selected
										</span>
									) : null}
								</div>
								<p className="mt-1 text-sm text-muted-foreground">
									{template.description}
								</p>
							</div>
						</button>
					);
				})}
			</div>
			{selectMutation.isPending ? (
				<output
					aria-live="polite"
					className="flex items-center gap-2 text-xs text-muted-foreground"
				>
					<Loader2
						aria-hidden="true"
						className="size-3 animate-spin"
					/>
					Updating document style…
				</output>
			) : null}
		</div>
	);
}
