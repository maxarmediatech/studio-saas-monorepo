"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { formatMoney } from "@saas/shared/lib";
import { useExpenseParams } from "@saas/studio/hooks/params/use-expense-params";
import { expensesApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	BriefcaseIcon,
	CalendarIcon,
	ChevronRight,
	CreditCardIcon,
	FileTextIcon,
	FolderIcon,
	HashIcon,
	PencilIcon,
	ReceiptIcon,
	TagIcon,
	UserIcon,
} from "lucide-react";
import Link from "next/link";

const BILL_TO_LABELS: Record<string, string> = {
	studio: "Studio",
	client: "Client",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
	cash: "Cash",
	upi: "UPI",
	bank_transfer: "Bank Transfer",
	cheque: "Cheque",
	card: "Card",
	other: "Other",
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

type Props = {
	organizationSlug: string;
	expenseId: string;
};

export function ExpenseDetailPageClient({
	organizationSlug,
	expenseId,
}: Props) {
	const { openEdit } = useExpenseParams();

	const { data: expenseData, isLoading } = useQuery(
		expensesApi.getOptions(expenseId),
	);
	const expense = expenseData?.data;
	const expensesHref = `/app/${organizationSlug}/expenses`;

	if (isLoading) {
		return <ExpenseDetailSkeleton />;
	}

	if (!expense) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-muted-foreground">Expense not found</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[860px] py-6 px-4">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2 text-sm">
					<Link
						href={expensesHref}
						className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
					>
						<ReceiptIcon className="size-4" />
						Expenses
					</Link>
					<ChevronRight className="size-4 text-muted-foreground" />
					<span className="font-medium text-foreground truncate max-w-[360px]">
						{expense.description}
					</span>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => openEdit(expense.id)}
				>
					<PencilIcon className="mr-1 size-4" />
					Edit
				</Button>
			</div>

			<div className="mt-8">
				<div className="flex items-start gap-4">
					<div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
						<ReceiptIcon className="size-8" />
					</div>
					<div className="flex-1 min-w-0">
						<h1 className="text-3xl font-semibold text-foreground">
							{formatMoney(expense.amount)}
						</h1>

						<div className="mt-3 space-y-2">
							<div className="flex items-center gap-2 text-sm">
								<CalendarIcon className="size-4 text-muted-foreground" />
								<span className="text-muted-foreground">
									Expense date
								</span>
								<span className="font-medium">
									{format(
										new Date(expense.expenseDate),
										"MMMM d, yyyy",
									)}
								</span>
							</div>

							{expense.vendor ? (
								<div className="flex items-center gap-2 text-sm">
									<BriefcaseIcon className="size-4 text-muted-foreground" />
									<span className="text-muted-foreground">
										Vendor
									</span>
									<span className="font-medium">
										{expense.vendor}
									</span>
								</div>
							) : null}
						</div>

						<div className="mt-4 flex flex-wrap items-center gap-2">
							{expense.category ? (
								<Badge variant="outline">
									<TagIcon className="mr-1 size-3.5" />
									{expense.category}
								</Badge>
							) : null}
							<Badge variant="secondary">
								<FolderIcon className="mr-1 size-3.5" />
								Bill to{" "}
								{BILL_TO_LABELS[expense.billTo] ??
									expense.billTo}
							</Badge>
							{expense.paymentMethod ? (
								<Badge
									variant={
										PAYMENT_METHOD_VARIANTS[
											expense.paymentMethod
										] ?? "outline"
									}
								>
									<CreditCardIcon className="mr-1 size-3.5" />
									{PAYMENT_METHOD_LABELS[
										expense.paymentMethod
									] ?? expense.paymentMethod}
								</Badge>
							) : null}
						</div>
					</div>
				</div>
			</div>

			<div className="mt-8 border-t pt-6">
				<h2 className="font-semibold flex items-center gap-2">
					<FileTextIcon className="size-4" />
					Expense Details
				</h2>

				<div className="mt-4 space-y-4">
					<div className="flex items-start gap-3">
						<HashIcon className="size-4 text-muted-foreground mt-0.5" />
						<div>
							<div className="text-xs text-muted-foreground uppercase tracking-wide">
								Expense ID
							</div>
							<div className="font-mono text-sm">
								{expense.id}
							</div>
						</div>
					</div>

					{expense.transactionReference ? (
						<div className="flex items-start gap-3">
							<HashIcon className="size-4 text-muted-foreground mt-0.5" />
							<div>
								<div className="text-xs text-muted-foreground uppercase tracking-wide">
									Transaction Reference
								</div>
								<div className="font-mono text-sm">
									{expense.transactionReference}
								</div>
							</div>
						</div>
					) : null}

					{expense.notes ? (
						<div className="flex items-start gap-3">
							<FileTextIcon className="size-4 text-muted-foreground mt-0.5" />
							<div>
								<div className="text-xs text-muted-foreground uppercase tracking-wide">
									Notes
								</div>
								<div className="text-sm whitespace-pre-wrap">
									{expense.notes}
								</div>
							</div>
						</div>
					) : null}
				</div>
			</div>

			<div className="mt-8 border-t pt-6">
				<h2 className="font-semibold flex items-center gap-2">
					<FolderIcon className="size-4" />
					Assignments ({expense.assignments.length})
				</h2>

				{expense.assignments.length === 0 ? (
					<p className="mt-3 text-sm text-muted-foreground">
						No allocations linked to this expense.
					</p>
				) : (
					<div className="mt-4 space-y-2">
						{expense.assignments.map((assignment) => (
							<div
								key={assignment.id}
								className="rounded-lg border p-3 space-y-2"
							>
								{assignment.bookingId ? (
									<div className="text-sm">
										<span className="text-muted-foreground">
											Booking:{" "}
										</span>
										<Link
											href={`/app/${organizationSlug}/bookings/${assignment.bookingId}`}
											className="font-medium hover:underline"
										>
											{assignment.bookingName ||
												"View booking"}
										</Link>
										{assignment.bookingReferenceNumber ? (
											<span className="text-muted-foreground">
												{" "}
												(
												{
													assignment.bookingReferenceNumber
												}
												)
											</span>
										) : null}
									</div>
								) : null}

								{assignment.shootId ? (
									<div className="text-sm">
										<span className="text-muted-foreground">
											Shoot:{" "}
										</span>
										<Link
											href={`/app/${organizationSlug}/shoots/${assignment.shootId}`}
											className="font-medium hover:underline"
										>
											{assignment.shootName ||
												"View shoot"}
										</Link>
									</div>
								) : null}

								{assignment.crewId ? (
									<div className="text-sm">
										<span className="text-muted-foreground">
											Crew:{" "}
										</span>
										<Link
											href={`/app/${organizationSlug}/people/${assignment.crewId}`}
											className="font-medium hover:underline inline-flex items-center gap-1"
										>
											<UserIcon className="size-3.5" />
											{assignment.crewName || "View crew"}
										</Link>
									</div>
								) : null}

								{assignment.allocationAmount ? (
									<div className="text-sm">
										<span className="text-muted-foreground">
											Allocated amount:{" "}
										</span>
										<span className="font-medium">
											{formatMoney(
												assignment.allocationAmount,
											)}
										</span>
									</div>
								) : null}

								{assignment.allocationPercentage ? (
									<div className="text-sm">
										<span className="text-muted-foreground">
											Allocated percentage:{" "}
										</span>
										<span className="font-medium">
											{assignment.allocationPercentage}%
										</span>
									</div>
								) : null}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

export function ExpenseDetailSkeleton() {
	return (
		<div className="mx-auto w-full max-w-[860px] px-4 py-6">
			<Skeleton className="h-6 w-64" />
			<Skeleton className="mt-8 h-12 w-72" />
			<Skeleton className="mt-4 h-4 w-80" />
			<Skeleton className="mt-6 h-32 w-full" />
		</div>
	);
}
