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
import { Skeleton } from "@repo/ui/components/skeleton";
import { formatMoney } from "@saas/shared/lib";
import { receiptsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
	ArrowLeftIcon,
	CalendarIcon,
	CreditCardIcon,
	DownloadIcon,
	FileTextIcon,
} from "lucide-react";
import Link from "next/link";

interface ReceiptDetailPageClientProps {
	organizationSlug: string;
	receiptId: string;
}

export function ReceiptDetailPageClient({
	organizationSlug,
	receiptId,
}: ReceiptDetailPageClientProps) {
	const { data: receiptData, isLoading } = useQuery(
		receiptsApi.getOptions(receiptId),
	);

	const receipt = receiptData?.data;

	if (isLoading) {
		return <ReceiptDetailSkeleton />;
	}

	if (!receipt) {
		return (
			<div className="flex flex-col items-center justify-center py-12">
				<p className="text-muted-foreground">Receipt not found</p>
				<Button variant="outline" className="mt-4" asChild>
					<Link href={`/app/${organizationSlug}/receipts`}>
						<ArrowLeftIcon className="mr-2 h-4 w-4" />
						Back to Receipts
					</Link>
				</Button>
			</div>
		);
	}

	const isVoided = !!receipt.deletedAt;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Button variant="ghost" size="icon" asChild>
						<Link href={`/app/${organizationSlug}/receipts`}>
							<ArrowLeftIcon className="h-4 w-4" />
						</Link>
					</Button>
					<div>
						<h1 className="text-2xl font-bold font-mono">
							{receipt.receiptNumber}
						</h1>
						<p className="text-muted-foreground">Payment Receipt</p>
					</div>
					{isVoided && <Badge variant="destructive">Voided</Badge>}
				</div>

				<Button variant="outline" asChild>
					<a
						href={`/api/receipts/${receiptId}/pdf`}
						download={`${receipt.receiptNumber}.pdf`}
					>
						<DownloadIcon className="mr-2 h-4 w-4" />
						Download PDF
					</a>
				</Button>
			</div>

			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Amount</CardDescription>
					</CardHeader>
					<CardContent>
						<span className="text-2xl font-bold">
							{formatMoney(receipt.amount)}
						</span>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Receipt Date</CardDescription>
					</CardHeader>
					<CardContent className="flex items-center gap-2">
						<CalendarIcon className="h-4 w-4 text-muted-foreground" />
						<span>
							{new Date(receipt.receiptDate).toLocaleDateString(
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
						<CardDescription>Payment Method</CardDescription>
					</CardHeader>
					<CardContent className="flex items-center gap-2">
						<CreditCardIcon className="h-4 w-4 text-muted-foreground" />
						<span className="capitalize">
							{receipt.paymentMethod ?? "—"}
						</span>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Invoice</CardDescription>
					</CardHeader>
					<CardContent className="flex items-center gap-2">
						<FileTextIcon className="h-4 w-4 text-muted-foreground" />
						{receipt.invoiceId ? (
							<Link
								href={`/app/${organizationSlug}/invoices/${receipt.invoiceId}`}
								className="hover:underline font-mono"
							>
								{receipt.invoice?.invoiceNumber ?? "View"}
							</Link>
						) : (
							<span className="text-muted-foreground">—</span>
						)}
					</CardContent>
				</Card>
			</div>

			{receipt.booking && (
				<Card>
					<CardHeader>
						<CardTitle>Booking</CardTitle>
					</CardHeader>
					<CardContent>
						<Link
							href={`/app/${organizationSlug}/bookings/${receipt.bookingId}`}
							className="hover:underline"
						>
							{receipt.booking.name}
						</Link>
						{receipt.booking.referenceNumber && (
							<span className="text-muted-foreground ml-2 font-mono">
								({receipt.booking.referenceNumber})
							</span>
						)}
					</CardContent>
				</Card>
			)}

			{receipt.notes && (
				<Card>
					<CardHeader>
						<CardTitle>Notes</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground whitespace-pre-wrap">
							{receipt.notes}
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function ReceiptDetailSkeleton() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Skeleton className="h-10 w-10 rounded" />
					<div>
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-4 w-32 mt-1" />
					</div>
				</div>
				<Skeleton className="h-10 w-32" />
			</div>

			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
				{[1, 2, 3, 4].map((i) => (
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
					<Skeleton className="h-4 w-48" />
				</CardContent>
			</Card>
		</div>
	);
}
