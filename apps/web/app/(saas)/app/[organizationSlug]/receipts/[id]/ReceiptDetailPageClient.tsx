"use client";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { formatMoney } from "@saas/shared/lib";
import { PageContent } from "@saas/studio";
import { receiptsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
	CalendarDays,
	CreditCard,
	DownloadIcon,
	FileTextIcon,
	LinkIcon,
	UserCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface ReceiptDetailPageClientProps {
	organizationSlug: string;
	receiptId: string;
}

// ── Helpers ──────────────────────────────────────────────────────

function StatusBadge({ isVoided }: { isVoided: boolean }) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset capitalize",
				isVoided
					? "bg-red-50 text-red-700 ring-red-600/10"
					: "bg-green-50 text-green-700 ring-green-600/20",
			)}
		>
			{isVoided ? "Voided" : "Active"}
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

export function ReceiptDetailPageClient({
	organizationSlug,
	receiptId,
}: ReceiptDetailPageClientProps) {
	const { activeOrganization } = useActiveOrganization();
	const organizationName = activeOrganization?.name ?? "Studio";
	const {
		data: receiptData,
		isLoading,
		isError,
	} = useQuery(receiptsApi.getOptions(receiptId));

	const receipt = receiptData?.data;

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

	if (isLoading) {
		return <ReceiptDetailSkeleton organizationSlug={organizationSlug} />;
	}

	if (isError) {
		return (
			<PageContent
				title="Receipt"
				backHref={`/app/${organizationSlug}/receipts`}
			>
				<div className="flex min-h-[400px] flex-col items-center justify-center">
					<p className="text-sm text-destructive">
						Failed to load receipt
					</p>
					<Link
						href={`/app/${organizationSlug}/receipts`}
						className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-500"
					>
						&larr; Back to receipts
					</Link>
				</div>
			</PageContent>
		);
	}

	if (!receipt) {
		return (
			<PageContent
				title="Receipt"
				backHref={`/app/${organizationSlug}/receipts`}
			>
				<div className="flex min-h-[400px] flex-col items-center justify-center">
					<p className="text-sm text-muted-foreground">
						Receipt not found
					</p>
					<Link
						href={`/app/${organizationSlug}/receipts`}
						className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-500"
					>
						&larr; Back to receipts
					</Link>
				</div>
			</PageContent>
		);
	}

	const isVoided = !!receipt.deletedAt;

	// Build activity timeline
	const activityItems: {
		label: React.ReactNode;
		date: string;
		icon: "default" | "check";
	}[] = [
		{
			label: (
				<span className="font-medium text-gray-900">
					Receipt created
				</span>
			),
			date: receipt.createdAt,
			icon: "default",
		},
	];

	if (isVoided && receipt.deletedAt) {
		activityItems.push({
			label: (
				<span className="font-medium text-red-600">Receipt voided</span>
			),
			date: receipt.deletedAt,
			icon: "default",
		});
	}

	return (
		<PageContent
			title="Receipt Detail"
			backHref={`/app/${organizationSlug}/receipts`}
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
							href={`/api/receipts/${receiptId}/pdf`}
							download={`${receipt.receiptNumber}.pdf`}
						>
							<DownloadIcon className="mr-2 h-4 w-4" />
							Download
						</a>
					</Button>
				</>
			}
		>
			{/* ── Gradient Banner ── */}
			<div className="relative isolate mb-8 overflow-hidden rounded-lg border border-gray-200/80 bg-gradient-to-r from-slate-50 via-white to-blue-50/70 px-6 py-6 sm:px-8">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full blur-3xl"
				/>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute -left-10 -bottom-20 h-44 w-44 rounded-full bg-blue-200/30 blur-3xl"
				/>

				<div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="text-xs font-semibold tracking-[0.16em] text-gray-500 uppercase">
							Receipt
						</p>
						<h2 className="mt-2 text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
							#{receipt.receiptNumber}
						</h2>
						<p className="mt-1 text-sm text-gray-600">
							<span className="font-medium text-gray-900">
								{organizationName}
							</span>
							<span className="mx-2 text-gray-300">/</span>
							{receipt.booking?.name ?? "No booking"}
						</p>
					</div>

					{isVoided && <StatusBadge isVoided />}
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
									{formatMoney(receipt.amount)}
								</dd>
							</div>
							<div className="flex-none self-end px-6 pt-4">
								<StatusBadge isVoided={isVoided} />
							</div>

							{/* Booking */}
							{receipt.booking && (
								<div className="mt-6 flex w-full flex-none gap-x-4 border-t border-gray-900/5 px-6 pt-6">
									<dt className="flex-none">
										<span className="sr-only">Booking</span>
										<UserCircle className="h-6 w-5 text-gray-400" />
									</dt>
									<dd className="text-sm/6 font-medium text-gray-900">
										<Link
											href={`/app/${organizationSlug}/bookings/${receipt.bookingId}`}
											className="hover:text-blue-600"
										>
											{receipt.booking.name}
										</Link>
									</dd>
								</div>
							)}

							{/* Receipt date */}
							<div className="mt-4 flex w-full flex-none gap-x-4 px-6">
								<dt className="flex-none">
									<span className="sr-only">
										Receipt date
									</span>
									<CalendarDays className="h-6 w-5 text-gray-400" />
								</dt>
								<dd className="text-sm/6 text-gray-500">
									<time dateTime={receipt.receiptDate}>
										{formatDate(receipt.receiptDate)}
									</time>
								</dd>
							</div>

							{/* Payment method */}
							<div className="mt-4 flex w-full flex-none gap-x-4 px-6 pb-6">
								<dt className="flex-none">
									<span className="sr-only">
										Payment method
									</span>
									<CreditCard className="h-6 w-5 text-gray-400" />
								</dt>
								<dd className="text-sm/6 text-gray-500 capitalize">
									{receipt.paymentMethod ?? "Not specified"}
								</dd>
							</div>
						</dl>

						{/* View invoice link */}
						{receipt.invoice && (
							<div className="border-t border-gray-900/5 px-6 py-6">
								<Link
									href={`/app/${organizationSlug}/invoices/${receipt.invoiceId}`}
									className="text-sm/6 font-semibold text-gray-900"
								>
									View invoice{" "}
									<span aria-hidden="true">&rarr;</span>
								</Link>
							</div>
						)}
					</div>
				</div>

				{/* ── Left 2 Columns: Receipt Detail Card ── */}
				<div className="-mx-4 px-4 py-8 ring-1 ring-gray-900/5 sm:mx-0 sm:rounded-lg sm:px-8 sm:pb-14 lg:col-span-2 lg:row-span-2 lg:row-end-2 xl:px-16 xl:pb-20 xl:pt-16">
					<h2 className="text-base font-semibold text-gray-900">
						Receipt
					</h2>

					{/* Date */}
					<dl className="mt-6 grid grid-cols-1 text-sm/6 sm:grid-cols-2">
						<div className="sm:pr-4">
							<dt className="inline text-gray-500">
								Received on
							</dt>{" "}
							<dd className="inline text-gray-700">
								<time dateTime={receipt.receiptDate}>
									{formatDate(receipt.receiptDate)}
								</time>
							</dd>
						</div>
					</dl>

					{/* From / To */}
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
										{receipt.booking?.name ?? "No booking"}
									</span>
									{receipt.booking?.referenceNumber && (
										<>
											<br />
											<span className="font-mono text-xs text-gray-400">
												{
													receipt.booking
														.referenceNumber
												}
											</span>
										</>
									)}
								</dd>
							</div>
						</dl>
					</div>

					{/* Receipt summary table (single row) */}
					<table className="mt-16 w-full whitespace-nowrap text-left text-sm/6">
						<colgroup>
							<col className="w-full" />
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
								<th
									scope="col"
									className="py-3 pl-8 pr-0 text-right font-semibold"
								>
									Amount
								</th>
							</tr>
						</thead>
						<tbody>
							<tr className="border-b border-gray-100">
								<td className="max-w-0 px-0 py-5 align-top">
									<div className="truncate font-medium text-gray-900">
										Payment received
									</div>
									{receipt.paymentMethod && (
										<div className="truncate text-gray-500">
											via{" "}
											<span className="capitalize">
												{receipt.paymentMethod}
											</span>
										</div>
									)}
								</td>
								<td className="py-5 pl-8 pr-0 text-right align-top tabular-nums text-gray-700">
									{formatMoney(receipt.amount)}
								</td>
							</tr>
						</tbody>
						<tfoot>
							<tr>
								<th
									scope="row"
									className="px-0 pt-6 font-semibold text-gray-900"
								>
									Total
								</th>
								<td className="pl-8 pr-0 pt-6 text-right font-semibold tabular-nums text-gray-900">
									{formatMoney(receipt.amount)}
								</td>
							</tr>
						</tfoot>
					</table>

					{/* Linked invoice reference */}
					{receipt.invoice && (
						<div className="mt-6 flex items-center gap-x-4 border-t border-gray-900/5 pt-6">
							<FileTextIcon className="h-5 w-5 text-gray-400" />
							<div className="text-sm/6">
								<span className="text-gray-500">Invoice </span>
								<Link
									href={`/app/${organizationSlug}/invoices/${receipt.invoiceId}`}
									className="font-medium text-blue-600 hover:text-blue-500"
								>
									{receipt.invoice.invoiceNumber}
								</Link>
								<span className="text-gray-500">
									{" "}
									&middot; Total{" "}
									{formatMoney(receipt.invoice.totalAmount)}
								</span>
							</div>
						</div>
					)}
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

								{/* Dot */}
								<div className="relative flex h-6 w-6 flex-none items-center justify-center bg-white">
									<div className="h-1.5 w-1.5 rounded-full bg-gray-100 ring-1 ring-gray-300" />
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
			{receipt.notes && (
				<div className="mt-8">
					<h2 className="text-sm/6 font-semibold text-gray-900">
						Notes
					</h2>
					<p className="mt-2 text-sm/6 text-gray-500 whitespace-pre-wrap">
						{receipt.notes}
					</p>
				</div>
			)}
		</PageContent>
	);
}

// ── Skeleton ─────────────────────────────────────────────────────

export function ReceiptDetailSkeleton({
	organizationSlug,
}: {
	organizationSlug?: string;
}) {
	return (
		<PageContent
			title={<Skeleton className="h-5 w-40" />}
			backHref={
				organizationSlug
					? `/app/${organizationSlug}/receipts`
					: undefined
			}
		>
			{/* Banner skeleton */}
			<div className="mb-8 rounded-lg border border-gray-200/70 bg-gray-50/70 p-6 sm:p-8">
				<Skeleton className="h-3 w-20" />
				<Skeleton className="mt-3 h-7 w-48" />
				<Skeleton className="mt-2 h-4 w-56" />
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
							<Skeleton className="h-4 w-32" />
						</div>
					</div>
				</div>

				{/* Receipt card skeleton */}
				<div className="rounded-lg p-8 ring-1 ring-gray-900/5 lg:col-span-2 lg:row-span-2 lg:row-end-2">
					<Skeleton className="h-5 w-20" />
					<div className="mt-6">
						<Skeleton className="h-4 w-40" />
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
						<Skeleton className="h-10 w-full" />
					</div>
				</div>

				{/* Activity skeleton */}
				<div className="lg:col-start-3">
					<Skeleton className="h-4 w-16" />
					<div className="mt-6 space-y-6">
						{[1, 2].map((i) => (
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
