"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Separator } from "@repo/ui/components/separator";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
import { formatMoney } from "@saas/shared/lib";
import { invoicesApi, invoicesMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeftIcon,
	CalendarIcon,
	DownloadIcon,
	Loader2Icon,
	SendIcon,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface InvoiceDetailPageClientProps {
	organizationSlug: string;
	invoiceId: string;
}

const STATUS_COLORS: Record<string, string> = {
	draft: "bg-gray-100 text-gray-800",
	sent: "bg-blue-100 text-blue-800",
	paid: "bg-green-100 text-green-800",
	partial: "bg-yellow-100 text-yellow-800",
	overdue: "bg-red-100 text-red-800",
	cancelled: "bg-gray-100 text-gray-800",
};

export function InvoiceDetailPageClient({
	organizationSlug,
	invoiceId,
}: InvoiceDetailPageClientProps) {
	const queryClient = useQueryClient();

	const { data: invoiceData, isLoading } = useQuery(
		invoicesApi.getOptions(invoiceId),
	);

	const invoice = invoiceData?.data;

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
		return <InvoiceDetailSkeleton />;
	}

	if (!invoice) {
		return (
			<div className="flex flex-col items-center justify-center py-12">
				<p className="text-muted-foreground">Invoice not found</p>
				<Button variant="outline" className="mt-4" asChild>
					<Link href={`/app/${organizationSlug}/invoices`}>
						<ArrowLeftIcon className="mr-2 h-4 w-4" />
						Back to Invoices
					</Link>
				</Button>
			</div>
		);
	}

	const canMarkSent = invoice.status === "draft";
	const canCancel = ["draft", "sent", "partial", "overdue"].includes(
		invoice.status,
	);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" asChild>
						<Link href={`/app/${organizationSlug}/invoices`}>
							<ArrowLeftIcon className="h-4 w-4" />
						</Link>
					</Button>
					<div>
						<h1 className="text-2xl font-bold font-mono">
							{invoice.invoiceNumber}
						</h1>
						<p className="text-muted-foreground">
							{invoice.booking?.name}
						</p>
					</div>
					<Badge
						className={
							STATUS_COLORS[invoice.status] ?? STATUS_COLORS.draft
						}
					>
						{invoice.status}
					</Badge>
				</div>

				<div className="flex items-center gap-2">
					<Button variant="outline" asChild>
						<a
							href={`/api/invoices/${invoiceId}/pdf`}
							download={`${invoice.invoiceNumber}.pdf`}
						>
							<DownloadIcon className="mr-2 h-4 w-4" />
							Download PDF
						</a>
					</Button>

					{canMarkSent && (
						<Button
							onClick={() =>
								markSentMutation.mutate({ id: invoiceId })
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

					{canCancel && (
						<Button
							variant="destructive"
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
				</div>
			</div>

			<div className="grid gap-6 md:grid-cols-3">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Issue Date</CardDescription>
					</CardHeader>
					<CardContent className="flex items-center gap-2">
						<CalendarIcon className="h-4 w-4 text-muted-foreground" />
						<span>
							{new Date(invoice.issueDate).toLocaleDateString(
								"en-IN",
								{
									day: "numeric",
									month: "short",
									year: "numeric",
								},
							)}
						</span>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Due Date</CardDescription>
					</CardHeader>
					<CardContent className="flex items-center gap-2">
						<CalendarIcon className="h-4 w-4 text-muted-foreground" />
						<span>
							{invoice.dueDate
								? new Date(invoice.dueDate).toLocaleDateString(
										"en-IN",
										{
											day: "numeric",
											month: "short",
											year: "numeric",
										},
									)
								: "Not set"}
						</span>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Amount Paid</CardDescription>
					</CardHeader>
					<CardContent>
						<span className="text-lg font-semibold">
							{formatMoney(invoice.paidAmount ?? "0")}
						</span>
						<span className="text-muted-foreground">
							{" "}
							/ {formatMoney(invoice.totalAmount)}
						</span>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Line Items</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[50%]">
									Description
								</TableHead>
								<TableHead className="text-right">
									Qty
								</TableHead>
								<TableHead className="text-right">
									Unit Price
								</TableHead>
								<TableHead className="text-right">
									Amount
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{invoice.lineItems?.map((item) => (
								<TableRow key={item.id}>
									<TableCell>{item.description}</TableCell>
									<TableCell className="text-right tabular-nums">
										{item.quantity}
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{formatMoney(item.unitPrice)}
									</TableCell>
									<TableCell className="text-right tabular-nums font-medium">
										{formatMoney(item.amount)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>

					<Separator className="my-4" />

					<div className="flex flex-col items-end gap-2">
						<div className="flex justify-between w-64">
							<span className="text-muted-foreground">
								Subtotal
							</span>
							<span className="tabular-nums">
								{formatMoney(invoice.subtotal)}
							</span>
						</div>
						<div className="flex justify-between w-64">
							<span className="text-muted-foreground">
								Tax (GST)
							</span>
							<span className="tabular-nums">
								{formatMoney(invoice.taxAmount)}
							</span>
						</div>
						{Number(invoice.discountAmount) > 0 && (
							<div className="flex justify-between w-64">
								<span className="text-muted-foreground">
									Discount
								</span>
								<span className="tabular-nums text-green-600">
									-{formatMoney(invoice.discountAmount)}
								</span>
							</div>
						)}
						<Separator className="w-64" />
						<div className="flex justify-between w-64 font-semibold">
							<span>Total</span>
							<span className="tabular-nums">
								{formatMoney(invoice.totalAmount)}
							</span>
						</div>
					</div>
				</CardContent>
			</Card>

			{invoice.notes && (
				<Card>
					<CardHeader>
						<CardTitle>Notes</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground whitespace-pre-wrap">
							{invoice.notes}
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function InvoiceDetailSkeleton() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Skeleton className="h-10 w-10 rounded" />
					<div>
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-4 w-32 mt-1" />
					</div>
					<Skeleton className="h-6 w-16 rounded-full" />
				</div>
				<div className="flex items-center gap-2">
					<Skeleton className="h-10 w-32" />
					<Skeleton className="h-10 w-32" />
				</div>
			</div>

			<div className="grid gap-6 md:grid-cols-3">
				{[1, 2, 3].map((i) => (
					<Card key={i}>
						<CardHeader className="pb-2">
							<Skeleton className="h-4 w-20" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-6 w-32" />
						</CardContent>
					</Card>
				))}
			</div>

			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-24" />
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-12 w-full" />
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
