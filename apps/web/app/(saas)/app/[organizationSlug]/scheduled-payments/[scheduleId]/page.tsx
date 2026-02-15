"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { formatMoney } from "@saas/shared/lib";
import {
	getScheduleStatusIcon,
	getScheduleStatusLabel,
	getScheduleStatusVariant,
} from "@saas/studio/components/schedules/schedule-status-presentation";
import { InvoiceGenerateSheet } from "@saas/studio/components/invoices/sheets/InvoiceGenerateSheet";
import { useInvoiceGenerateParams } from "@saas/studio/hooks/params/use-invoice-generate-params";
import { useScheduleParams } from "@saas/studio/hooks/params/use-schedule-params";
import { studioPaymentsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	CalendarClockIcon,
	CalendarIcon,
	ChevronRight,
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

export default function ScheduleDetailPage() {
	const params = useParams<{
		organizationSlug: string;
		scheduleId: string;
	}>();
	const { openEdit } = useScheduleParams();
	const { openEdit: openGenerateInvoice } = useInvoiceGenerateParams();

	const { data: scheduleData, isLoading } = useQuery(
		studioPaymentsApi.getScheduleOptions(params.scheduleId),
	);

	const schedule = scheduleData?.data;
	const schedulesHref = `/app/${params.organizationSlug}/scheduled-payments`;

	if (isLoading) {
		return (
			<div className="mx-auto w-full max-w-[860px] py-6 px-4">
				<Skeleton className="h-6 w-64" />
				<Skeleton className="mt-8 h-12 w-72" />
				<Skeleton className="mt-4 h-4 w-80" />
				<Skeleton className="mt-6 h-32 w-full" />
			</div>
		);
	}

	if (!schedule) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-muted-foreground">
					Payment schedule not found
				</div>
			</div>
		);
	}

	const StatusIcon = getScheduleStatusIcon(schedule.status);
	const isCompleted = schedule.status === "completed";
	const isCancelled = schedule.status === "cancelled";
	const paid = Number(schedule.paidAmount);
	const amount = Number(schedule.amount);
	const paidPercent = amount > 0 ? Math.min((paid / amount) * 100, 100) : 0;
	const canGenerateInvoice =
		!schedule.invoiceId &&
		!isCompleted &&
		!isCancelled &&
		paid <= 0 &&
		schedule.status !== "partial";

	return (
		<>
			<div className="mx-auto w-full max-w-[860px] py-6 px-4">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2 text-sm">
					<Link
						href={schedulesHref}
						className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
					>
						<CalendarClockIcon className="size-4" />
						Scheduled Payments
					</Link>
					<ChevronRight className="size-4 text-muted-foreground" />
					<span className="font-medium text-foreground">
						{schedule.name}
					</span>
				</div>
				<div className="flex items-center gap-2">
					{canGenerateInvoice && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => openGenerateInvoice(schedule.id)}
						>
							<FileTextIcon className="mr-1 size-4" />
							Generate Invoice
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={() => openEdit(schedule.id)}
					>
						<PencilIcon className="mr-1 size-4" />
						Edit
					</Button>
				</div>
			</div>

			<div className="mt-8">
				<div className="flex items-start gap-4">
					<div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
						<CalendarClockIcon className="size-8" />
					</div>
					<div className="flex-1 min-w-0">
						<h1 className="text-3xl font-semibold text-foreground">
							{formatMoney(schedule.amount)}
						</h1>

						<div className="mt-3 space-y-2">
							<div className="flex items-center gap-2 text-sm">
								<FolderIcon className="size-4 text-muted-foreground" />
								<span className="text-muted-foreground">
									for
								</span>
								<Link
									href={`/app/${params.organizationSlug}/bookings/${schedule.booking.id}`}
									className="font-medium text-foreground hover:underline"
								>
									{schedule.booking.name}
								</Link>
								<span className="text-muted-foreground">
									({schedule.booking.referenceNumber})
								</span>
							</div>

							<div className="flex items-center gap-2 text-sm">
								<CalendarIcon className="size-4 text-muted-foreground" />
								<span className="text-muted-foreground">
									Due on
								</span>
								<span className="font-medium">
									{format(
										new Date(schedule.dueDate),
										"MMMM d, yyyy",
									)}
								</span>
							</div>
						</div>

						<div className="mt-4">
							<Badge
								variant={getScheduleStatusVariant(
									schedule.status,
								)}
								className={cn(
									"gap-1",
									isCompleted &&
										"bg-green-100 text-green-700 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400",
								)}
							>
								<StatusIcon className="size-3.5" />
								{getScheduleStatusLabel(schedule.status)}
							</Badge>
						</div>

						<div className="mt-5 max-w-sm">
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">
									Paid
								</span>
								<span className="font-medium">
									{formatMoney(schedule.paidAmount)} /{" "}
									{formatMoney(schedule.amount)}
								</span>
							</div>
							<div className="mt-2 h-2 rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-primary transition-all"
									style={{ width: `${paidPercent}%` }}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="mt-8 border-t pt-6">
				<h2 className="font-semibold flex items-center gap-2">
					<FileTextIcon className="size-4" />
					Schedule Details
				</h2>

				<div className="mt-4 space-y-4">
					<div className="flex items-start gap-3">
						<HashIcon className="size-4 text-muted-foreground mt-0.5" />
						<div>
							<div className="text-xs text-muted-foreground uppercase tracking-wide">
								Schedule ID
							</div>
							<div className="font-mono text-sm">
								{schedule.id}
							</div>
						</div>
					</div>

					{schedule.notes ? (
						<div className="flex items-start gap-3">
							<FileTextIcon className="size-4 text-muted-foreground mt-0.5" />
							<div>
								<div className="text-xs text-muted-foreground uppercase tracking-wide">
									Notes
								</div>
								<div className="text-sm whitespace-pre-wrap">
									{schedule.notes}
								</div>
							</div>
						</div>
					) : null}
				</div>
			</div>

			<div className="mt-8 border-t pt-6">
				<h2 className="font-semibold flex items-center gap-2">
					<ReceiptIcon className="size-4" />
					Linked Payments ({schedule.linkedPayments.length})
				</h2>

				{schedule.linkedPayments.length === 0 ? (
					<p className="mt-3 text-sm text-muted-foreground">
						No received payments linked to this schedule yet.
					</p>
				) : (
					<div className="mt-4 space-y-2">
						{schedule.linkedPayments.map((payment) => (
							<Link
								key={payment.id}
								href={`/app/${params.organizationSlug}/payments/${payment.id}`}
								className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors"
							>
								<div className="min-w-0">
									<div className="font-medium">
										{formatMoney(payment.amount)}
									</div>
									<div className="text-sm text-muted-foreground">
										{format(
											new Date(payment.receivedDate),
											"MMM d, yyyy",
										)}
									</div>
								</div>
								<Badge variant="outline">
									{PAYMENT_METHOD_LABELS[
										payment.paymentMethod
									] ?? payment.paymentMethod}
								</Badge>
							</Link>
						))}
					</div>
				)}
			</div>
		</div>

			<InvoiceGenerateSheet />
		</>
	);
}
