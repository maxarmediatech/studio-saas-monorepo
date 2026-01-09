"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import {
	useDeliverableParams,
	usePaymentParams,
	useShootParams,
} from "@saas/studio/hooks/params";
import {
	deliverablesApi,
	shootsApi,
	studioPaymentsApi,
} from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	AlertCircleIcon,
	CalendarIcon,
	CameraIcon,
	ClockIcon,
	MapPinIcon,
	PackageIcon,
	PencilIcon,
	PlusIcon,
	WalletIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface BookingDetailContentProps {
	bookingId: string;
	packageCost: string;
	totalReceived: string;
	balance: string;
	className?: string;
}

type PaymentMethod =
	| "cash"
	| "upi"
	| "bank_transfer"
	| "cheque"
	| "card"
	| "other";

// ============================================================================
// Constants
// ============================================================================

const paymentMethodColors: Record<
	PaymentMethod,
	"default" | "secondary" | "destructive" | "outline"
> = {
	cash: "default",
	upi: "secondary",
	bank_transfer: "outline",
	cheque: "secondary",
	card: "default",
	other: "outline",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
	cash: "Cash",
	upi: "UPI",
	bank_transfer: "Bank Transfer",
	cheque: "Cheque",
	card: "Card",
	other: "Other",
};

// ============================================================================
// Utilities
// ============================================================================

const formatCurrency = (amount: number | string) => {
	const num =
		typeof amount === "string" ? Number.parseFloat(amount) || 0 : amount;
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(num);
};

const getStatusVariant = (
	status: string,
): "default" | "secondary" | "destructive" | "outline" => {
	switch (status) {
		case "pending":
			return "secondary";
		case "in_progress":
			return "default";
		case "completed":
			return "outline";
		case "cancelled":
			return "secondary";
		default:
			return "default";
	}
};

const getPriorityVariant = (
	priority: string,
): "default" | "secondary" | "destructive" | "outline" => {
	switch (priority) {
		case "high":
			return "destructive";
		case "medium":
			return "secondary";
		case "low":
			return "outline";
		default:
			return "default";
	}
};

// ============================================================================
// Section Components
// ============================================================================

interface ShootsSectionProps {
	bookingId: string;
}

function ShootsSection({ bookingId }: ShootsSectionProps) {
	const { openCreate, openEdit } = useShootParams();

	const {
		data: shoots,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...shootsApi.listOptions({ bookingId, limit: 50 }),
		enabled: !!bookingId,
	});

	const shootsList = shoots?.data ?? [];
	const count = shootsList.length;

	const completedCount = shootsList.filter(
		(s) => s.status === "completed",
	).length;
	const isAllComplete = count > 0 && completedCount === count;

	return (
		<div className="border-b">
			{/* Header */}
			<div className="flex items-center justify-between p-4 pb-3 border-b">
				<div className="flex items-center gap-2">
					<CameraIcon className="h-4 w-4 text-muted-foreground" />
					<h3 className="text-sm font-medium">Shoots</h3>
					<Badge variant="secondary" className="text-xs">
						{count}
					</Badge>
					{isAllComplete && count > 0 && (
						<Badge
							variant="outline"
							className="text-xs bg-green-50 text-green-700 border-green-200"
						>
							Complete
						</Badge>
					)}
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="h-7"
					onClick={() => openCreate()}
				>
					<PlusIcon className="h-3 w-3 mr-1" />
					Add Shoot
				</Button>
			</div>

			{/* Content */}
			<div className="p-4">
				{isLoading ? (
					<div className="space-y-3">
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
					</div>
				) : isError ? (
					<div className="flex flex-col items-center gap-2 py-6 text-center">
						<AlertCircleIcon className="h-8 w-8 text-destructive/50" />
						<p className="text-sm text-destructive">
							Failed to load shoots
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => refetch()}
						>
							Try again
						</Button>
					</div>
				) : shootsList.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-6 text-center">
						<CameraIcon className="h-8 w-8 text-muted-foreground/50" />
						<p className="text-sm text-muted-foreground">
							No shoots scheduled
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => openCreate()}
						>
							<PlusIcon className="h-4 w-4 mr-2" />
							Add Shoot
						</Button>
					</div>
				) : (
					<div className="space-y-3">
						{shootsList.map((shoot) => {
							const shootDate = shoot.shootDate
								? format(
										new Date(shoot.shootDate),
										"MMM d, yyyy",
									)
								: "No date";

							const timeRange =
								shoot.startTime && shoot.endTime
									? `${format(new Date(`2000-01-01T${shoot.startTime}`), "h:mm a")} - ${format(new Date(`2000-01-01T${shoot.endTime}`), "h:mm a")}`
									: null;

							return (
								<div
									key={shoot.id}
									className="flex items-center justify-between rounded-lg border bg-background p-3 hover:bg-muted/50 transition-colors"
								>
									<div className="flex-1 space-y-1 min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<h4 className="font-medium truncate">
												{shoot.shootType ||
													shoot.name ||
													"Unnamed Shoot"}
											</h4>
											<Badge
												variant="outline"
												className="capitalize text-xs"
											>
												{shoot.status}
											</Badge>
										</div>

										<div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
											<div className="flex items-center gap-1">
												<CameraIcon className="h-3 w-3" />
												<span>{shootDate}</span>
											</div>

											{timeRange && (
												<div className="flex items-center gap-1">
													<ClockIcon className="h-3 w-3" />
													<span>{timeRange}</span>
												</div>
											)}

											{shoot.venue && (
												<div className="flex items-center gap-1">
													<MapPinIcon className="h-3 w-3" />
													<span className="truncate max-w-[150px]">
														{shoot.venue}
													</span>
												</div>
											)}
										</div>
									</div>

									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 shrink-0"
										onClick={() => openEdit(shoot.id)}
										aria-label={`Edit ${shoot.shootType || shoot.name || "shoot"}`}
									>
										<PencilIcon className="h-3.5 w-3.5" />
									</Button>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

interface DeliverablesSectionProps {
	bookingId: string;
}

function DeliverablesSection({ bookingId }: DeliverablesSectionProps) {
	const { openCreate, openEdit } = useDeliverableParams();

	const {
		data: deliverables,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...deliverablesApi.listOptions({ bookingId, limit: 50 }),
		enabled: !!bookingId,
	});

	const items = deliverables?.data ?? [];
	const count = items.length;

	const completedCount = items.filter((d) => d.status === "completed").length;
	const progressPercentage = count > 0 ? (completedCount / count) * 100 : 0;

	return (
		<div className="border-b">
			{/* Header */}
			<div className="flex items-center justify-between p-4 pb-3 border-b">
				<div className="flex items-center gap-2">
					<PackageIcon className="h-4 w-4 text-muted-foreground" />
					<h3 className="text-sm font-medium">Deliverables</h3>
					<Badge variant="secondary" className="text-xs">
						{count}
					</Badge>
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="h-7"
					onClick={() => openCreate()}
				>
					<PlusIcon className="h-3 w-3 mr-1" />
					Add
				</Button>
			</div>

			{/* Progress indicator */}
			{count > 0 && (
				<div className="px-4 pt-3 space-y-1.5">
					<Progress value={progressPercentage} className="h-1.5" />
					<p className="text-xs text-muted-foreground">
						{completedCount} of {count} complete
					</p>
				</div>
			)}

			{/* Content */}
			<div className="p-4 pt-3">
				{isLoading ? (
					<div className="space-y-3">
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-20 w-full" />
					</div>
				) : isError ? (
					<div className="flex flex-col items-center gap-2 py-6 text-center">
						<AlertCircleIcon className="h-8 w-8 text-destructive/50" />
						<p className="text-sm text-destructive">
							Failed to load deliverables
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => refetch()}
						>
							Try again
						</Button>
					</div>
				) : items.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-6 text-center">
						<PackageIcon className="h-8 w-8 text-muted-foreground/50" />
						<p className="text-sm text-muted-foreground">
							No deliverables added
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => openCreate()}
						>
							<PlusIcon className="h-4 w-4 mr-2" />
							Add Deliverable
						</Button>
					</div>
				) : (
					<div className="space-y-3">
						{items.map((deliverable) => (
							<div
								key={deliverable.id}
								className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3 hover:bg-muted/50 transition-colors"
							>
								<div className="flex-1 space-y-1.5 min-w-0">
									<h4 className="font-medium truncate">
										{deliverable.name}
									</h4>

									<div className="flex items-center gap-1.5 flex-wrap">
										{deliverable.deliverableType && (
											<Badge
												variant="outline"
												className="text-xs"
											>
												{deliverable.deliverableType}
											</Badge>
										)}

										<Badge
											variant={getStatusVariant(
												deliverable.status,
											)}
											className="text-xs capitalize"
										>
											{deliverable.status.replace(
												"_",
												" ",
											)}
										</Badge>

										{deliverable.priority && (
											<Badge
												variant={getPriorityVariant(
													deliverable.priority,
												)}
												className="text-xs capitalize"
											>
												{deliverable.priority}
											</Badge>
										)}
									</div>

									{deliverable.dueDate && (
										<div className="flex items-center gap-1 text-xs text-muted-foreground">
											<CalendarIcon className="h-3 w-3" />
											<span>
												Due:{" "}
												{format(
													new Date(
														deliverable.dueDate,
													),
													"MMM d, yyyy",
												)}
											</span>
										</div>
									)}

									{deliverable.description && (
										<p className="text-xs text-muted-foreground line-clamp-1">
											{deliverable.description}
										</p>
									)}
								</div>

								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 shrink-0"
									onClick={() => openEdit(deliverable.id)}
									aria-label={`Edit ${deliverable.name}`}
								>
									<PencilIcon className="h-3.5 w-3.5" />
								</Button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

interface PaymentsSectionProps {
	bookingId: string;
	packageCost: string;
	totalReceived: string;
	balance: string;
}

function PaymentsSection({
	bookingId,
	packageCost,
	totalReceived,
	balance,
}: PaymentsSectionProps) {
	const { openCreate, openEdit } = usePaymentParams();

	const {
		data: payments,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...studioPaymentsApi.listReceivedOptions({ bookingId, limit: 50 }),
		enabled: !!bookingId,
	});

	const paymentsList = payments?.data ?? [];
	const count = paymentsList.length;

	const packageCostNum = Number.parseFloat(packageCost);
	const totalReceivedNum = Number.parseFloat(totalReceived);
	const balanceNum = Number.parseFloat(balance);
	const progressPercentage =
		packageCostNum > 0 ? (totalReceivedNum / packageCostNum) * 100 : 0;
	const isPaid = balanceNum <= 0;

	return (
		<div>
			{/* Header */}
			<div className="flex items-center justify-between p-4 pb-3 border-b">
				<div className="flex items-center gap-2">
					<WalletIcon className="h-4 w-4 text-muted-foreground" />
					<h3 className="text-sm font-medium">Payment Details</h3>
					<Badge
						variant="outline"
						className={cn(
							"text-xs",
							isPaid
								? "bg-green-50 text-green-700 border-green-200"
								: "bg-amber-50 text-amber-700 border-amber-200",
						)}
					>
						{isPaid ? "Paid" : "Pending"}
					</Badge>
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="h-7"
					onClick={() => openCreate()}
				>
					<PlusIcon className="h-3 w-3 mr-1" />
					Record Payment
				</Button>
			</div>

			{/* Financial Summary */}
			<div className="p-4 border-b bg-muted/30">
				<div className="grid grid-cols-3 gap-4 text-center">
					<div>
						<p className="text-xs text-muted-foreground">
							Package Cost
						</p>
						<p className="text-lg font-semibold">
							{formatCurrency(packageCost)}
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">
							Received
						</p>
						<p className="text-lg font-semibold text-green-600">
							{formatCurrency(totalReceived)}
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Balance</p>
						<p
							className={cn(
								"text-lg font-semibold",
								balanceNum > 0
									? "text-amber-600"
									: "text-green-600",
							)}
						>
							{formatCurrency(balance)}
						</p>
					</div>
				</div>

				{/* Progress bar */}
				<div className="mt-3 space-y-1">
					<Progress
						value={Math.min(progressPercentage, 100)}
						className="h-1.5"
					/>
					<p className="text-xs text-muted-foreground text-right">
						{progressPercentage.toFixed(0)}% paid
					</p>
				</div>
			</div>

			{/* Payment History */}
			<div className="p-4">
				{isLoading ? (
					<div className="space-y-3">
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
					</div>
				) : isError ? (
					<div className="flex flex-col items-center gap-2 py-6 text-center">
						<AlertCircleIcon className="h-8 w-8 text-destructive/50" />
						<p className="text-sm text-destructive">
							Failed to load payments
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => refetch()}
						>
							Try again
						</Button>
					</div>
				) : paymentsList.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-6 text-center">
						<WalletIcon className="h-8 w-8 text-muted-foreground/50" />
						<p className="text-sm text-muted-foreground">
							No payments recorded
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => openCreate()}
						>
							<PlusIcon className="h-4 w-4 mr-2" />
							Record Payment
						</Button>
					</div>
				) : (
					<div className="space-y-3">
						<p className="text-xs font-medium text-muted-foreground">
							Payment History ({count})
						</p>
						{paymentsList.map((payment) => (
							<div
								key={payment.id}
								className="flex items-center justify-between rounded-lg border bg-background p-3 hover:bg-muted/50 transition-colors"
							>
								<div className="flex-1 space-y-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-semibold">
											{formatCurrency(payment.amount)}
										</span>
										<Badge
											variant={
												paymentMethodColors[
													payment.paymentMethod as PaymentMethod
												] || "outline"
											}
											className="text-xs"
										>
											{paymentMethodLabels[
												payment.paymentMethod as PaymentMethod
											] || payment.paymentMethod}
										</Badge>
									</div>
									<div className="text-xs text-muted-foreground">
										<span>
											{format(
												new Date(payment.receivedDate),
												"MMM d, yyyy",
											)}
										</span>
										{payment.transactionReference && (
											<span className="ml-2">
												• Ref:{" "}
												{payment.transactionReference}
											</span>
										)}
									</div>
									{payment.notes && (
										<p className="text-xs text-muted-foreground truncate">
											{payment.notes}
										</p>
									)}
								</div>

								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 shrink-0"
									onClick={() => openEdit(payment.id)}
									aria-label="Edit payment"
								>
									<PencilIcon className="h-3.5 w-3.5" />
								</Button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Unified booking detail content card
 * Combines Shoots, Deliverables, and Payments into a single bordered component
 */
export function BookingDetailContent({
	bookingId,
	packageCost,
	totalReceived,
	balance,
	className,
}: BookingDetailContentProps) {
	return (
		<Card className={cn("shadow-none", className)}>
			<CardContent className="p-0">
				{/* Section 1: Shoots */}
				<ShootsSection bookingId={bookingId} />

				{/* Section 2: Deliverables */}
				<DeliverablesSection bookingId={bookingId} />

				{/* Section 3: Payments */}
				<PaymentsSection
					bookingId={bookingId}
					packageCost={packageCost}
					totalReceived={totalReceived}
					balance={balance}
				/>
			</CardContent>
		</Card>
	);
}
