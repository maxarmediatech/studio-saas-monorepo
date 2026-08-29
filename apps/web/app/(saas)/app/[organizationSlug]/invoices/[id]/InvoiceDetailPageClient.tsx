"use client";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { formatMoney } from "@saas/shared/lib";
import { PageContent } from "@saas/studio";
import { InvoiceEditSheet } from "@saas/studio/components/invoices/sheets/InvoiceEditSheet";
import { useInvoiceEditParams } from "@saas/studio/hooks/params/use-invoice-edit-params";
import {
	invoicesApi,
	invoicesMutations,
	receiptsApi,
} from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CalendarDays,
	CheckCircle2,
	CreditCard,
	DownloadIcon,
	LinkIcon,
	Loader2Icon,
	PencilIcon,
	SendIcon,
	UserCircle,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface InvoiceDetailPageClientProps {
	organizationSlug: string;
	invoiceId: string;
}

// ── Helpers ──────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
	draft: "bg-gray-50 text-gray-600 ring-gray-500/10",
	sent: "bg-blue-50 text-blue-700 ring-blue-700/10",
	paid: "bg-green-50 text-green-700 ring-green-600/20",
	partial: "bg-yellow-50 text-yellow-800 ring-yellow-600/20",
	overdue: "bg-red-50 text-red-700 ring-red-600/10",
	cancelled: "bg-gray-50 text-gray-600 ring-gray-500/10",
};

function StatusBadge({ status }: { status: string }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset capitalize",
				STATUS_STYLES[status] ?? STATUS_STYLES.draft,
			)}
		>
			{status}
		</span>
	);
}

function formatDate(date: string | null | undefined) {
	if (!date) {
		return "Not set";
	}
	return new Date(date).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
		year: "numeric",
	});
}

function formatRelativeTime(date: string) {
	const now = new Date();
	const then = new Date(date);
	const diffMs = now.getTime() - then.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		return "Today";
	}
	if (diffDays === 1) {
		return "Yesterday";
	}
	if (diffDays < 30) {
		return `${diffDays}d ago`;
	}
	if (diffDays < 365) {
		return `${Math.floor(diffDays / 30)}mo ago`;
	}
	return `${Math.floor(diffDays / 365)}y ago`;
}

// ── Main Component ───────────────────────────────────────────────

export function InvoiceDetailPageClient({
	organizationSlug,
	invoiceId,
}: InvoiceDetailPageClientProps) {
	const { activeOrganization } = useActiveOrganization();
	const organizationName = activeOrganization?.name ?? "Studio";
	const queryClient = useQueryClient();
	const { openEdit } = useInvoiceEditParams();

	const {
		data: invoiceData,
		isLoading,
		isError,
	} = useQuery(invoicesApi.getOptions(invoiceId));

	const { data: receiptsData } = useQuery(
		receiptsApi.listOptions({ invoiceId, limit: 100 }),
	);

	const invoice = invoiceData?.data;
	const receipts = receiptsData?.data ?? [];

	const markSentMutation = useMutation({
		...invoicesMutations.markSent(),
		onSuccess: () => {
			toast.success("Invoice marked as sent");
			queryClient.invalidateQueries({
				queryKey: orpc.invoices.key(),
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to mark invoice as sent");
		},
	});

	const cancelMutation = useMutation({
		...invoicesMutations.cancel(),
		onSuccess: () => {
			toast.success("Invoice cancelled");
			queryClient.invalidateQueries({
				queryKey: orpc.invoices.key(),
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to cancel invoice");
		},
	});

	if (isLoading) {
		return <InvoiceDetailSkeleton organizationSlug={organizationSlug} />;
	}

	if (isError) {
		return (
			<PageContent
				title="Invoice"
				backHref={`/app/${organizationSlug}/invoices`}
			>
				<div className="flex min-h-[400px] flex-col items-center justify-center">
					<p className="text-sm text-destructive">
						Failed to load invoice
					</p>
					<Link
						href={`/app/${organizationSlug}/invoices`}
						className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-500"
					>
						&larr; Back to invoices
					</Link>
				</div>
			</PageContent>
		);
	}

	if (!invoice) {
		return (
			<PageContent
				title="Invoice"
				backHref={`/app/${organizationSlug}/invoices`}
			>
				<div className="flex min-h-[400px] flex-col items-center justify-center">
					<p className="text-sm text-muted-foreground">
						Invoice not found
					</p>
					<Link
						href={`/app/${organizationSlug}/invoices`}
						className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-500"
					>
						&larr; Back to invoices
					</Link>
				</div>
			</PageContent>
		);
	}

	const canMarkSent = invoice.status === "draft";
	const hasPaidAmount = Number(invoice.paidAmount ?? "0") > 0;
	const canEdit =
		["draft", "sent", "overdue"].includes(invoice.status) && !hasPaidAmount;
	const canCancel =
		["draft", "sent", "partial", "overdue", "paid"].includes(
			invoice.status,
		) && Number(invoice.paidAmount ?? "0") === 0;
	const handleCopyUrl = async () => {
		const url = window.location.href;

		try {
			if (navigator.clipboard?.writeText && window.isSecureContext) {
				await navigator.clipboard.writeText(url);
				toast.success("Link copied to clipboard");
				return;
			}

			const input = document.createElement("textarea");
			input.value = url;
			input.setAttribute("readonly", "");
			input.style.position = "absolute";
			input.style.left = "-9999px";
			document.body.appendChild(input);
			input.select();
			const copied = document.execCommand("copy");
			document.body.removeChild(input);

			if (!copied) {
				throw new Error("Copy command failed");
			}

			toast.success("Link copied to clipboard");
		} catch {
			toast.error("Failed to copy link");
		}
	};

	// Build activity timeline from real invoice timestamps + receipts
	const activityItems: {
		label: React.ReactNode;
		date: string;
		icon: "default" | "check";
	}[] = [
		{
			label: (
				<span className="font-medium text-gray-900">
					Invoice created
				</span>
			),
			date: invoice.createdAt,
			icon: "default",
		},
	];

	if (invoice.sentAt) {
		activityItems.push({
			label: (
				<span className="font-medium text-gray-900">Invoice sent</span>
			),
			date: invoice.sentAt,
			icon: "default",
		});
	}

	// Add receipt entries — each receipt generates two timeline items
	for (const receipt of receipts) {
		if (receipt.receivedAmountId) {
			activityItems.push({
				label: (
					<Link
						href={`/app/${organizationSlug}/payments/${receipt.receivedAmountId}`}
						className="font-medium text-blue-600 hover:text-blue-500"
					>
						Payment received
					</Link>
				),
				date: receipt.createdAt,
				icon: "check",
			});
		}

		activityItems.push({
			label: (
				<Link
					href={`/app/${organizationSlug}/receipts/${receipt.id}`}
					className="font-medium text-blue-600 hover:text-blue-500"
				>
					Receipt generated
				</Link>
			),
			date: receipt.createdAt,
			icon: "check",
		});
	}

	if (invoice.paidAt) {
		activityItems.push({
			label: (
				<span className="font-medium text-gray-900">Invoice paid</span>
			),
			date: invoice.paidAt,
			icon: "check",
		});
	}

	if (invoice.status === "cancelled") {
		activityItems.push({
			label: (
				<span className="font-medium text-gray-900">
					Invoice cancelled
				</span>
			),
			date: invoice.updatedAt,
			icon: "default",
		});
	}

	// Sort chronologically
	activityItems.sort(
		(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
	);

	return (
		<>
			<PageContent
				title={"Invoice Detail"}
				backHref={`/app/${organizationSlug}/invoices`}
				controls={
					<>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								void handleCopyUrl();
							}}
						>
							<LinkIcon className="mr-2 h-4 w-4" />
							Copy URL
						</Button>
						<Button variant="outline" size="sm" asChild>
							<a
								href={`/api/invoices/${invoiceId}/pdf`}
								download={`${invoice.invoiceNumber}.pdf`}
							>
								<DownloadIcon className="mr-2 h-4 w-4" />
								Download
							</a>
						</Button>

						{canCancel && (
							<Button
								variant="destructive"
								size="sm"
								onClick={() =>
									cancelMutation.mutate({ id: invoiceId })
								}
								disabled={cancelMutation.isPending}
							>
								{cancelMutation.isPending ? (
									<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<XCircleIcon className="mr-2 h-4 w-4" />
								)}
								Cancel
							</Button>
						)}
					</>
				}
			>
				<div className="relative isolate mb-8 overflow-hidden rounded-lg border border-gray-200/80 bg-gradient-to-r from-slate-50 via-white to-emerald-50/70 px-6 py-6 sm:px-8">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full  blur-3xl"
					/>
					<div
						aria-hidden="true"
						className="pointer-events-none absolute -left-10 -bottom-20 h-44 w-44 rounded-full bg-blue-200/30 blur-3xl"
					/>

					<div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
						<div>
							<p className="text-xs font-semibold tracking-[0.16em] text-gray-500 uppercase">
								Invoice{" "}
							</p>
							<h2 className="mt-2 text-xl font-semibold tracking-tight text-gray-900 sm:text-xl">
								#{invoice.invoiceNumber}
							</h2>
							<p className="mt-1 text-sm text-gray-600">
								<span className="font-medium text-gray-900">
									{organizationName}
								</span>
								<span className="mx-2 text-gray-300">/</span>
								{invoice.client?.name ?? "No client"}
							</p>
						</div>
						<div className="flex flex-none flex-wrap gap-3">
							{canEdit && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => openEdit(invoiceId)}
								>
									<PencilIcon className="mr-2 h-4 w-4" />
									Edit
								</Button>
							)}

							{canMarkSent && (
								<Button
									size="sm"
									onClick={() =>
										markSentMutation.mutate({
											id: invoiceId,
										})
									}
									disabled={markSentMutation.isPending}
								>
									{markSentMutation.isPending ? (
										<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<SendIcon className="mr-2 h-4 w-4" />
									)}
									Mark as Sent
								</Button>
							)}
						</div>
					</div>
				</div>

				{/* ── 3-column stacked grid ── */}
				<div className="grid max-w-2xl grid-cols-1 grid-rows-1 items-start gap-x-8 gap-y-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
					{/* ── Right Column: Summary Card ── */}
					<div className="lg:col-start-3 lg:row-end-1">
						<h2 className="sr-only">Summary</h2>
						<div className="rounded-lg bg-gray-50 ring-1 ring-gray-900/5">
							<dl className="flex flex-wrap">
								{/* Amount */}
								<div className="flex-auto pl-6 pt-6">
									<dt className="text-sm/6 font-semibold text-gray-900">
										Amount
									</dt>
									<dd className="mt-1 text-base font-semibold text-gray-900">
										{formatMoney(invoice.totalAmount)}
									</dd>
								</div>
								<div className="flex-none self-end px-6 pt-4">
									<StatusBadge status={invoice.status} />
								</div>

								{/* Client */}
								<div className="mt-6 flex w-full flex-none gap-x-4 border-t border-gray-900/5 px-6 pt-6">
									<dt className="flex-none">
										<span className="sr-only">Client</span>
										<UserCircle className="h-6 w-5 text-gray-400" />
									</dt>
									<dd className="text-sm/6 font-medium text-gray-900">
										{invoice.client?.name ?? "No client"}
									</dd>
								</div>

								{/* Due date */}
								<div className="mt-4 flex w-full flex-none gap-x-4 px-6">
									<dt className="flex-none">
										<span className="sr-only">
											Due date
										</span>
										<CalendarDays className="h-6 w-5 text-gray-400" />
									</dt>
									<dd className="text-sm/6 text-gray-500">
										<time
											dateTime={
												invoice.dueDate ?? undefined
											}
										>
											{formatDate(invoice.dueDate)}
										</time>
									</dd>
								</div>

								{/* Payment info */}
								<div className="mt-4 flex w-full flex-none gap-x-4 px-6 pb-6">
									<dt className="flex-none">
										<span className="sr-only">Payment</span>
										<CreditCard className="h-6 w-5 text-gray-400" />
									</dt>
									<dd className="text-sm/6 text-gray-500">
										{formatMoney(invoice.paidAmount ?? "0")}{" "}
										paid of{" "}
										{formatMoney(invoice.totalAmount)}
									</dd>
								</div>
							</dl>

							{/* Download receipt link — only shown when a receipt exists */}
							{receipts.length > 0 && (
								<div className="border-t border-gray-900/5 px-6 py-6">
									<a
										href={`/api/receipts/${receipts[0].id}/pdf`}
										download={`${receipts[0].receiptNumber}.pdf`}
										className="text-sm/6 font-semibold text-gray-900"
									>
										Download receipt{" "}
										<span aria-hidden="true">&rarr;</span>
									</a>
								</div>
							)}
						</div>
					</div>

					{/* ── Left 2 Columns: Invoice Card ── */}
					<div className="-mx-4 px-4 py-8 ring-1 ring-gray-900/5 sm:mx-0 sm:rounded-lg sm:px-8 sm:pb-14 lg:col-span-2 lg:row-span-2 lg:row-end-2 xl:px-16 xl:pb-20 xl:pt-16">
						<h2 className="text-base font-semibold text-gray-900">
							Invoice
						</h2>

						{/* Dates */}
						<dl className="mt-6 grid grid-cols-1 text-sm/6 sm:grid-cols-2">
							<div className="sm:pr-4">
								<dt className="inline text-gray-500">
									Issued on
								</dt>{" "}
								<dd className="inline text-gray-700">
									<time dateTime={invoice.issueDate}>
										{formatDate(invoice.issueDate)}
									</time>
								</dd>
							</div>
							<div className="mt-2 sm:mt-0 sm:pl-4">
								<dt className="inline text-gray-500">Due on</dt>{" "}
								<dd className="inline text-gray-700">
									<time
										dateTime={invoice.dueDate ?? undefined}
									>
										{formatDate(invoice.dueDate)}
									</time>
								</dd>
							</div>
						</dl>

						{/* From / To addresses */}
						<div className="mt-6 border-t border-gray-900/5 pt-6 sm:pr-4">
							<dl className="grid grid-cols-1 text-sm/6 sm:grid-cols-2">
								<div>
									<dt className="font-semibold text-gray-900">
										From
									</dt>
									<dd className="mt-2 text-gray-500">
										<span className="font-medium text-gray-900">
											{organizationName}
										</span>
									</dd>
								</div>
								<div className="mt-8 sm:mt-0">
									<dt className="font-semibold text-gray-900">
										To
									</dt>
									<dd className="mt-2 text-gray-500">
										<span className="font-medium text-gray-900">
											{invoice.client?.name ??
												"No client"}
										</span>
										<br />
										{invoice.client?.email ?? ""}
									</dd>
								</div>
							</dl>
						</div>

						{/* Line items table (native HTML, not shadcn) */}
						{(() => {
							const hasItemizedRows = invoice.lineItems?.some(
								(i) =>
									i.type === "item" || i.type === "service",
							);
							const footerColSpan = hasItemizedRows ? 3 : 1;
							return (
								<table className="mt-16 w-full whitespace-nowrap text-left text-sm/6">
									<colgroup>
										<col className="w-full" />
										{hasItemizedRows && (
											<>
												<col />
												<col />
											</>
										)}
										<col />
									</colgroup>
									<thead className="border-b border-gray-200 text-gray-900">
										<tr>
											<th
												scope="col"
												className="px-0 py-3 font-semibold"
											>
												Description
											</th>
											{hasItemizedRows && (
												<>
													<th
														scope="col"
														className="hidden py-3 pl-8 pr-0 text-right font-semibold sm:table-cell"
													>
														Qty
													</th>
													<th
														scope="col"
														className="hidden py-3 pl-8 pr-0 text-right font-semibold sm:table-cell"
													>
														Rate
													</th>
												</>
											)}
											<th
												scope="col"
												className="py-3 pl-8 pr-0 text-right font-semibold"
											>
												Amount
											</th>
										</tr>
									</thead>
									<tbody>
										{invoice.lineItems?.map((item) => {
											const isLumpSum =
												item.type === "milestone" ||
												item.type === "expense";
											return (
												<tr
													key={item.id}
													className="border-b border-gray-100"
												>
													<td className="max-w-0 px-0 py-5 align-top">
														<div className="truncate font-medium text-gray-900">
															{item.description}
														</div>
													</td>
													{hasItemizedRows && (
														<>
															<td className="hidden py-5 pl-8 pr-0 text-right align-top tabular-nums text-gray-700 sm:table-cell">
																{isLumpSum
																	? "\u2014"
																	: item.quantity}
															</td>
															<td className="hidden py-5 pl-8 pr-0 text-right align-top tabular-nums text-gray-700 sm:table-cell">
																{isLumpSum ||
																item.unitPrice ==
																	null
																	? "\u2014"
																	: formatMoney(
																			item.unitPrice,
																		)}
															</td>
														</>
													)}
													<td className="py-5 pl-8 pr-0 text-right align-top tabular-nums text-gray-700">
														{formatMoney(
															item.amount,
														)}
													</td>
												</tr>
											);
										})}
									</tbody>
									<tfoot>
										{/* Subtotal: shown for exclusive, no_gst, or inclusive-with-discount */}
										{(invoice.taxType !== "inclusive" ||
											Number(invoice.discountAmount) >
												0) && (
											<tr>
												<th
													scope="row"
													className="px-0 pb-0 pt-6 font-normal text-gray-700 sm:hidden"
												>
													Subtotal
												</th>
												<th
													scope="row"
													colSpan={footerColSpan}
													className="hidden px-0 pb-0 pt-6 text-right font-normal text-gray-700 sm:table-cell"
												>
													Subtotal
												</th>
												<td className="pb-0 pl-8 pr-0 pt-6 text-right tabular-nums text-gray-900">
													{formatMoney(
														invoice.subtotal,
													)}
												</td>
											</tr>
										)}

										{/* Inclusive with discount: show discount before taxable value */}
										{invoice.taxType === "inclusive" &&
											Number(invoice.discountAmount) >
												0 && (
												<tr>
													<th
														scope="row"
														className="px-0 pt-4 font-normal text-gray-700 sm:hidden"
													>
														Discount
													</th>
													<th
														scope="row"
														colSpan={footerColSpan}
														className="hidden px-0 pt-4 text-right font-normal text-gray-700 sm:table-cell"
													>
														Discount
													</th>
													<td className="pl-8 pr-0 pt-4 text-right tabular-nums text-green-600">
														-
														{formatMoney(
															invoice.discountAmount,
														)}
													</td>
												</tr>
											)}

										{/* Inclusive GST: show Taxable Value (totalAmount - taxAmount) */}
										{invoice.taxType === "inclusive" && (
											<tr>
												<th
													scope="row"
													className={cn(
														"px-0 font-normal text-gray-700 sm:hidden",
														Number(
															invoice.discountAmount,
														) > 0
															? "pt-4"
															: "pb-0 pt-6",
													)}
												>
													Taxable Value
												</th>
												<th
													scope="row"
													colSpan={footerColSpan}
													className={cn(
														"hidden px-0 text-right font-normal text-gray-700 sm:table-cell",
														Number(
															invoice.discountAmount,
														) > 0
															? "pt-4"
															: "pb-0 pt-6",
													)}
												>
													Taxable Value
												</th>
												<td
													className={cn(
														"pl-8 pr-0 text-right tabular-nums text-gray-900",
														Number(
															invoice.discountAmount,
														) > 0
															? "pt-4"
															: "pb-0 pt-6",
													)}
												>
													{formatMoney(
														Number(
															invoice.totalAmount,
														) -
															Number(
																invoice.taxAmount,
															),
													)}
												</td>
											</tr>
										)}

										{/* Tax: shown for exclusive and inclusive */}
										{invoice.taxType !== "no_gst" && (
											<tr>
												<th
													scope="row"
													className="px-0 pt-4 font-normal text-gray-700 sm:hidden"
												>
													Tax (GST)
												</th>
												<th
													scope="row"
													colSpan={footerColSpan}
													className="hidden px-0 pt-4 text-right font-normal text-gray-700 sm:table-cell"
												>
													Tax (GST)
												</th>
												<td className="pl-8 pr-0 pt-4 text-right tabular-nums text-gray-900">
													{formatMoney(
														invoice.taxAmount,
													)}
												</td>
											</tr>
										)}

										{/* Exclusive/No GST: discount row */}
										{invoice.taxType !== "inclusive" &&
											Number(invoice.discountAmount) >
												0 && (
												<tr>
													<th
														scope="row"
														className="px-0 pt-4 font-normal text-gray-700 sm:hidden"
													>
														Discount
													</th>
													<th
														scope="row"
														colSpan={footerColSpan}
														className="hidden px-0 pt-4 text-right font-normal text-gray-700 sm:table-cell"
													>
														Discount
													</th>
													<td className="pl-8 pr-0 pt-4 text-right tabular-nums text-green-600">
														-
														{formatMoney(
															invoice.discountAmount,
														)}
													</td>
												</tr>
											)}

										{/* Total: always shown */}
										<tr>
											<th
												scope="row"
												className="px-0 pt-4 font-semibold text-gray-900 sm:hidden"
											>
												Total
											</th>
											<th
												scope="row"
												colSpan={footerColSpan}
												className="hidden px-0 pt-4 text-right font-semibold text-gray-900 sm:table-cell"
											>
												Total
											</th>
											<td className="pl-8 pr-0 pt-4 text-right font-semibold tabular-nums text-gray-900">
												{formatMoney(
													invoice.totalAmount,
												)}
											</td>
										</tr>
									</tfoot>
								</table>
							);
						})()}
					</div>

					{/* ── Right Column: Activity Feed ── */}
					<div className="lg:col-start-3">
						<h2 className="text-sm/6 font-semibold text-gray-900">
							Activity
						</h2>
						<ul className="mt-6 space-y-6">
							{activityItems.map((item, idx) => (
								<li key={idx} className="relative flex gap-x-4">
									{/* Vertical connector line */}
									<div
										className={cn(
											idx === activityItems.length - 1
												? "h-6"
												: "-bottom-6",
											"absolute left-0 top-0 flex w-6 justify-center",
										)}
									>
										<div className="w-px bg-gray-200" />
									</div>

									{/* Dot / icon */}
									<div className="relative flex h-6 w-6 flex-none items-center justify-center bg-white">
										{item.icon === "check" ? (
											<CheckCircle2 className="h-6 w-6 text-blue-600" />
										) : (
											<div className="h-1.5 w-1.5 rounded-full bg-gray-100 ring-1 ring-gray-300" />
										)}
									</div>

									{/* Content */}
									<p className="flex-auto py-0.5 text-xs/5 text-gray-500">
										{item.label}
									</p>
									<time
										dateTime={item.date}
										className="flex-none py-0.5 text-xs/5 text-gray-500"
									>
										{formatRelativeTime(item.date)}
									</time>
								</li>
							))}
						</ul>
					</div>
				</div>

				{/* ── Notes (optional) ── */}
				{invoice.notes && (
					<div className="mt-8">
						<h2 className="text-sm/6 font-semibold text-gray-900">
							Notes
						</h2>
						<p className="mt-2 text-sm/6 text-gray-500 whitespace-pre-wrap">
							{invoice.notes}
						</p>
					</div>
				)}
			</PageContent>
			<InvoiceEditSheet />
		</>
	);
}

// ── Skeleton ─────────────────────────────────────────────────────

export function InvoiceDetailSkeleton({
	organizationSlug,
}: {
	organizationSlug?: string;
}) {
	return (
		<PageContent
			title={<Skeleton className="h-5 w-40" />}
			backHref={
				organizationSlug
					? `/app/${organizationSlug}/invoices`
					: undefined
			}
		>
			<div className="mb-8 rounded-2xl border border-gray-200/70 bg-gray-50/70 p-6 sm:p-8">
				<Skeleton className="h-3 w-28" />
				<Skeleton className="mt-3 h-7 w-56" />
				<Skeleton className="mt-2 h-4 w-64" />
				<div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
					<div className="space-y-2">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-4 w-24" />
					</div>
					<div className="space-y-2">
						<Skeleton className="h-3 w-12" />
						<Skeleton className="h-4 w-24" />
					</div>
					<div className="space-y-2">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-4 w-24" />
					</div>
				</div>
			</div>

			<div className="grid max-w-2xl grid-cols-1 grid-rows-1 items-start gap-x-8 gap-y-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
				{/* Summary card skeleton */}
				<div className="lg:col-start-3 lg:row-end-1">
					<div className="rounded-lg bg-gray-50 p-6 ring-1 ring-gray-900/5">
						<Skeleton className="h-5 w-16" />
						<Skeleton className="mt-2 h-6 w-28" />
						<div className="mt-6 space-y-4 border-t border-gray-900/5 pt-6">
							<Skeleton className="h-4 w-36" />
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-4 w-40" />
						</div>
					</div>
				</div>

				{/* Invoice card skeleton */}
				<div className="rounded-lg p-8 ring-1 ring-gray-900/5 lg:col-span-2 lg:row-span-2 lg:row-end-2">
					<Skeleton className="h-5 w-20" />
					<div className="mt-6 grid grid-cols-2 gap-4">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-32" />
					</div>
					<div className="mt-6 border-t border-gray-900/5 pt-6">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Skeleton className="h-4 w-12" />
								<Skeleton className="h-4 w-28" />
							</div>
							<div className="space-y-2">
								<Skeleton className="h-4 w-8" />
								<Skeleton className="h-4 w-24" />
							</div>
						</div>
					</div>
					<div className="mt-16 space-y-4">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-10 w-full" />
						))}
					</div>
				</div>

				{/* Activity skeleton */}
				<div className="lg:col-start-3">
					<Skeleton className="h-4 w-16" />
					<div className="mt-6 space-y-6">
						{[1, 2, 3].map((i) => (
							<div key={i} className="flex gap-x-4">
								<Skeleton className="h-6 w-6 rounded-full" />
								<Skeleton className="h-4 flex-auto" />
								<Skeleton className="h-4 w-12" />
							</div>
						))}
					</div>
				</div>
			</div>
		</PageContent>
	);
}
