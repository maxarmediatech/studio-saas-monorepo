"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { formatMoney } from "@saas/shared/lib";
import { usePaymentParams } from "@saas/studio/hooks/params/use-payment-params";
import { studioPaymentsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	BanknoteIcon,
	CalendarIcon,
	ChevronRight,
	CreditCardIcon,
	ExternalLinkIcon,
	FileTextIcon,
	FolderIcon,
	HashIcon,
	PencilIcon,
	ReceiptIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
	cash: "Cash",
	upi: "UPI",
	bank_transfer: "Bank Transfer",
	cheque: "Cheque",
	card: "Card",
	other: "Other",
};

const PAYMENT_METHOD_ICONS: Record<string, React.ReactNode> = {
	cash: <BanknoteIcon className="size-4" />,
	upi: <CreditCardIcon className="size-4" />,
	bank_transfer: <CreditCardIcon className="size-4" />,
	cheque: <FileTextIcon className="size-4" />,
	card: <CreditCardIcon className="size-4" />,
	other: <ReceiptIcon className="size-4" />,
};

const PAYMENT_METHOD_VARIANTS: Record<
	string,
	"default" | "secondary" | "outline"
> = {
	cash: "default",
	upi: "secondary",
	bank_transfer: "outline",
	cheque: "outline",
	card: "secondary",
	other: "outline",
};

export default function PaymentDetailPage() {
	const params = useParams<{
		organizationSlug: string;
		paymentId: string;
	}>();
	const { openEdit } = usePaymentParams();

	const { data: paymentData, isLoading: paymentLoading } = useQuery(
		studioPaymentsApi.getReceivedOptions(params.paymentId),
	);

	const payment = paymentData?.data;

	const paymentsHref = `/app/${params.organizationSlug}/payments`;

	if (paymentLoading) {
		return (
			<div className="mx-auto w-full max-w-[800px] py-6 px-4">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="mt-8 h-12 w-64" />
				<Skeleton className="mt-4 h-4 w-96" />
				<Skeleton className="mt-6 h-32 w-full" />
			</div>
		);
	}

	if (!payment) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-muted-foreground">Payment not found</div>
			</div>
		);
	}

	const booking = payment.booking;
	const schedule = payment.schedule;

	return (
		<div className="mx-auto w-full max-w-[800px] py-6 px-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm">
					<Link
						href={paymentsHref}
						className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
					>
						<BanknoteIcon className="size-4" />
						Payments
					</Link>
					<ChevronRight className="size-4 text-muted-foreground" />
					<span className="font-medium text-foreground">
						{formatMoney(payment.amount)}
					</span>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => openEdit(payment.id)}
				>
					<PencilIcon className="mr-1 size-4" />
					Edit
				</Button>
			</div>

			<div className="mt-8">
				<div className="flex items-start gap-4">
					<div className="flex size-16 items-center justify-center rounded-full bg-green-500/10 text-green-600">
						<BanknoteIcon className="size-8" />
					</div>
					<div className="flex-1 min-w-0">
						<h1 className="text-3xl font-semibold text-green-600">
							{formatMoney(payment.amount)}
						</h1>

						<div className="mt-3 space-y-2">
							<div className="flex items-center gap-2 text-sm">
								<FolderIcon className="size-4 text-muted-foreground" />
								<span className="text-muted-foreground">
									for
								</span>
								<Link
									href={`/app/${params.organizationSlug}/bookings/${booking.id}`}
									className="font-medium text-foreground hover:underline"
								>
									{booking.name}
								</Link>
								<span className="text-muted-foreground">
									({booking.referenceNumber})
								</span>
							</div>

							<div className="flex items-center gap-2 text-sm">
								<CalendarIcon className="size-4 text-muted-foreground" />
								<span className="text-muted-foreground">
									Received on
								</span>
								<span className="font-medium">
									{format(
										new Date(payment.receivedDate),
										"MMMM d, yyyy",
									)}
								</span>
							</div>
						</div>

						<div className="mt-4 flex flex-wrap items-center gap-2">
							<Badge
								variant={
									PAYMENT_METHOD_VARIANTS[
										payment.paymentMethod
									]
								}
								className="flex items-center gap-1.5"
							>
								{PAYMENT_METHOD_ICONS[payment.paymentMethod]}
								{PAYMENT_METHOD_LABELS[payment.paymentMethod]}
							</Badge>
						</div>
					</div>
				</div>
			</div>

			<div className="mt-8 border-t pt-6">
				<h2 className="font-semibold flex items-center gap-2">
					<ReceiptIcon className="size-4" />
					Payment Details
				</h2>

				<div className="mt-4 space-y-4">
					{payment.transactionReference && (
						<div className="flex items-start gap-3">
							<HashIcon className="size-4 text-muted-foreground mt-0.5" />
							<div>
								<div className="text-xs text-muted-foreground uppercase tracking-wide">
									Transaction Reference
								</div>
								<div className="font-mono text-sm">
									{payment.transactionReference}
								</div>
							</div>
						</div>
					)}

					{schedule && (
						<div className="flex items-start gap-3">
							<CalendarIcon className="size-4 text-muted-foreground mt-0.5" />
							<div>
								<div className="text-xs text-muted-foreground uppercase tracking-wide">
									Payment Schedule
								</div>
								<div className="text-sm font-medium">
									{schedule.name}
								</div>
							</div>
						</div>
					)}

					{payment.notes && (
						<div className="flex items-start gap-3">
							<FileTextIcon className="size-4 text-muted-foreground mt-0.5" />
							<div>
								<div className="text-xs text-muted-foreground uppercase tracking-wide">
									Notes
								</div>
								<div className="text-sm whitespace-pre-wrap">
									{payment.notes}
								</div>
							</div>
						</div>
					)}

					{payment.proofAttachment && (
						<div className="flex items-start gap-3">
							<ExternalLinkIcon className="size-4 text-muted-foreground mt-0.5" />
							<div>
								<div className="text-xs text-muted-foreground uppercase tracking-wide">
									Payment Proof
								</div>
								<a
									href={payment.proofAttachment.url}
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm text-primary hover:underline flex items-center gap-1"
								>
									{payment.proofAttachment.name ||
										"View attachment"}
									<ExternalLinkIcon className="size-3" />
								</a>
							</div>
						</div>
					)}

					<div className="flex items-start gap-3">
						<CalendarIcon className="size-4 text-muted-foreground mt-0.5" />
						<div>
							<div className="text-xs text-muted-foreground uppercase tracking-wide">
								Recorded On
							</div>
							<div className="text-sm text-muted-foreground">
								{format(
									new Date(payment.createdAt),
									"MMM d, yyyy 'at' h:mm a",
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="mt-8 border-t pt-6">
				<h2 className="font-semibold flex items-center gap-2">
					<FolderIcon className="size-4" />
					Booking
				</h2>

				<Link
					href={`/app/${params.organizationSlug}/bookings/${booking.id}`}
					className="mt-4 flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
				>
					<div className="min-w-0">
						<div className="font-medium">{booking.name}</div>
						<div className="text-xs text-muted-foreground">
							{booking.referenceNumber}
						</div>
					</div>
					<ChevronRight className="size-4 text-muted-foreground" />
				</Link>
			</div>
		</div>
	);
}
