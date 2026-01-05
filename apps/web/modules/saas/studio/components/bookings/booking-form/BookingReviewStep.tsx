"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";
import { Separator } from "@repo/ui/components/separator";
import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
	CalendarIcon,
	CameraIcon,
	ClipboardListIcon,
	ClockIcon,
	MapPinIcon,
	PackageIcon,
	PencilIcon,
	UsersIcon,
	WalletIcon,
} from "lucide-react";
import { memo } from "react";
import { useWatch } from "react-hook-form";
import { bookingFormQueries } from "./booking-form-queries";
import type { BookingFormValues, BookingTab } from "./booking-form-schema";
import {
	DELIVERABLE_TYPE_OPTIONS,
	PAYMENT_METHOD_OPTIONS,
} from "./booking-form-schema";

// ============================================================================
// Shared utilities and types
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

const formatDate = (dateString: string) => {
	if (!dateString) {
		return "—";
	}
	return new Date(dateString).toLocaleDateString("en-IN", {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
	});
};

const getDeliverableType = (key: string) => {
	return DELIVERABLE_TYPE_OPTIONS.find((t) => t.value === key)?.label ?? key;
};

const getPaymentMethod = (key: string) => {
	return PAYMENT_METHOD_OPTIONS.find((t) => t.value === key)?.label ?? key;
};

// ============================================================================
// Memoized Section Components - each only re-renders when its data changes
// ============================================================================

interface SectionHeaderProps {
	icon: React.ReactNode;
	title: string;
	count?: number;
	onEdit: () => void;
}

const SectionHeader = memo(function SectionHeader({
	icon,
	title,
	count,
	onEdit,
}: SectionHeaderProps) {
	return (
		<CardHeader className="flex flex-row items-center justify-between pb-3">
			<CardTitle className="text-base flex items-center gap-2">
				{icon}
				{title}
				{count !== undefined && ` (${count})`}
			</CardTitle>
			<Button type="button" variant="ghost" size="sm" onClick={onEdit}>
				<PencilIcon className="h-3 w-3 mr-1" />
				Edit
			</Button>
		</CardHeader>
	);
});

// Booking Details Section - watches: name, bookingType, packageType, packageCost, note
const BookingDetailsSection = memo(function BookingDetailsSection({
	onNavigateToStep,
}: {
	onNavigateToStep: (step: BookingTab) => void;
}) {
	const name = useWatch<BookingFormValues, "name">({ name: "name" });
	const bookingType = useWatch<BookingFormValues, "bookingType">({
		name: "bookingType",
	});
	const packageType = useWatch<BookingFormValues, "packageType">({
		name: "packageType",
	});
	const packageCost = useWatch<BookingFormValues, "packageCost">({
		name: "packageCost",
	});
	const note = useWatch<BookingFormValues, "note">({ name: "note" });

	const { data: bookingTypesData } = useQuery(
		bookingFormQueries.bookingTypes(),
	);
	const { data: packageTypesData } = useQuery(
		bookingFormQueries.packageTypes(),
	);

	const getBookingType = (key: string) => {
		return bookingTypesData?.data?.find((t) => t.key === key)?.label ?? key;
	};

	const getPackageType = (key: string) => {
		return packageTypesData?.data?.find((t) => t.key === key)?.label ?? key;
	};

	const costNum = Number.parseFloat(packageCost) || 0;

	return (
		<Card>
			<SectionHeader
				icon={<ClipboardListIcon className="h-4 w-4" />}
				title="Booking Details"
				onEdit={() => onNavigateToStep("details")}
			/>
			<CardContent className="space-y-4">
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					<div>
						<p className="text-xs text-muted-foreground uppercase tracking-wide">
							Booking Name
						</p>
						<p className="font-medium">{name || "—"}</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground uppercase tracking-wide">
							Type
						</p>
						<p className="font-medium">
							{bookingType ? getBookingType(bookingType) : "—"}
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground uppercase tracking-wide">
							Package
						</p>
						<p className="font-medium">
							{packageType ? getPackageType(packageType) : "—"}
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground uppercase tracking-wide">
							Package Cost
						</p>
						<p className="text-xl font-bold text-primary">
							{formatCurrency(costNum)}
						</p>
					</div>
				</div>

				{note && (
					<div>
						<p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
							Notes
						</p>
						<p className="text-sm text-muted-foreground">{note}</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
});

// Participants Section - watches: participants
const ParticipantsSection = memo(function ParticipantsSection({
	onNavigateToStep,
}: {
	onNavigateToStep: (step: BookingTab) => void;
}) {
	const participants = useWatch<BookingFormValues, "participants">({
		name: "participants",
	});

	const { data: relationTypesData } = useQuery(
		bookingFormQueries.relationTypes(),
	);
	const { data: clientsData } = useQuery(bookingFormQueries.clients());

	const getClientName = (clientId: string) => {
		return (
			clientsData?.data?.find((c) => c.id === clientId)?.name ??
			"Unknown Client"
		);
	};

	const getRelationType = (key: string) => {
		return (
			relationTypesData?.data?.find((t) => t.key === key)?.label ?? key
		);
	};

	return (
		<Card>
			<SectionHeader
				icon={<UsersIcon className="h-4 w-4" />}
				title="Clients"
				count={participants.length}
				onEdit={() => onNavigateToStep("details")}
			/>
			<CardContent>
				{participants.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No clients added
					</p>
				) : (
					<ul className="space-y-2">
						{participants.map((p, i) => (
							<li key={i} className="flex items-center gap-2">
								<span className="font-medium">
									{p.clientId
										? getClientName(p.clientId)
										: "—"}
								</span>
								{p.role && (
									<Badge
										variant="secondary"
										className="text-xs"
									>
										{getRelationType(p.role)}
									</Badge>
								)}
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
});

// Shoots Section - watches: shoots
const ShootsSection = memo(function ShootsSection({
	onNavigateToStep,
}: {
	onNavigateToStep: (step: BookingTab) => void;
}) {
	const shoots = useWatch<BookingFormValues, "shoots">({ name: "shoots" });

	const { data: crewsData } = useQuery(bookingFormQueries.crews());
	const { data: eventTypesData } = useQuery(bookingFormQueries.eventTypes());

	const getCrewName = (crewId: string) => {
		return (
			crewsData?.data?.find((c) => c.id === crewId)?.name ??
			"Unknown Crew"
		);
	};

	const getEventType = (key: string) => {
		return eventTypesData?.data?.find((t) => t.key === key)?.label ?? key;
	};

	const shootsList = shoots ?? [];

	return (
		<Card>
			<SectionHeader
				icon={<CameraIcon className="h-4 w-4" />}
				title="Shoots"
				count={shootsList.length}
				onEdit={() => onNavigateToStep("shoots")}
			/>
			<CardContent>
				{shootsList.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No shoots scheduled
					</p>
				) : (
					<div className="space-y-4">
						{shootsList.map((shoot, i) => (
							<div key={i} className="p-3 bg-muted/50 rounded-lg">
								<div className="flex items-start justify-between">
									<p className="font-medium">
										{shoot.shootType
											? getEventType(shoot.shootType)
											: `Shoot ${i + 1}`}
									</p>
									<Badge
										variant="outline"
										className="text-xs"
									>
										<CalendarIcon className="h-3 w-3 mr-1" />
										{formatDate(shoot.shootDate)}
									</Badge>
								</div>
								{(shoot.startTime || shoot.location) && (
									<div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
										{shoot.startTime && (
											<span className="flex items-center gap-1">
												<ClockIcon className="h-3 w-3" />
												{shoot.startTime}
											</span>
										)}
										{shoot.location && (
											<span className="flex items-center gap-1">
												<MapPinIcon className="h-3 w-3" />
												{shoot.location}
											</span>
										)}
									</div>
								)}
								{(shoot.crewAssignments?.length ?? 0) > 0 && (
									<div className="mt-2 flex flex-wrap gap-1">
										{shoot.crewAssignments?.map(
											(crew, j) => (
												<Badge
													key={j}
													variant="secondary"
													className="text-xs"
												>
													{crew.crewId
														? getCrewName(
																crew.crewId,
															)
														: "—"}
												</Badge>
											),
										)}
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
});

// Payments Section - watches: packageCost, payments, paymentSchedules, deliverables
const PaymentsSection = memo(function PaymentsSection({
	onNavigateToStep,
}: {
	onNavigateToStep: (step: BookingTab) => void;
}) {
	const packageCost = useWatch<BookingFormValues, "packageCost">({
		name: "packageCost",
	});
	const payments = useWatch<BookingFormValues, "payments">({
		name: "payments",
	});
	const paymentSchedules = useWatch<BookingFormValues, "paymentSchedules">({
		name: "paymentSchedules",
	});
	const deliverables = useWatch<BookingFormValues, "deliverables">({
		name: "deliverables",
	});

	const packageCostNum = Number.parseFloat(packageCost) || 0;
	const paymentsList = payments ?? [];
	const schedulesList = paymentSchedules ?? [];
	const deliverablesList = deliverables ?? [];

	// Calculate custom deliverables cost
	const customDeliverablesCost = deliverablesList
		.filter((d) => !d.isPackageIncluded)
		.reduce((sum, d) => sum + (Number.parseFloat(d.cost ?? "0") || 0), 0);

	// Total booking cost = package + custom deliverables
	const totalBookingCost = packageCostNum + customDeliverablesCost;

	const totalReceived = paymentsList.reduce(
		(sum, p) => sum + (Number.parseFloat(p.amount) || 0),
		0,
	);
	const paymentPercentage =
		totalBookingCost > 0
			? Math.min(
					100,
					Math.round((totalReceived / totalBookingCost) * 100),
				)
			: 0;

	return (
		<Card>
			<SectionHeader
				icon={<WalletIcon className="h-4 w-4" />}
				title="Payments"
				onEdit={() => onNavigateToStep("payments")}
			/>
			<CardContent className="space-y-4">
				{/* Payment Progress */}
				<div className="space-y-2">
					<div className="flex items-center justify-between text-sm">
						<span className="text-muted-foreground">
							Payment Progress
						</span>
						<span className="font-medium">
							{paymentPercentage}%
						</span>
					</div>
					<Progress value={paymentPercentage} className="h-2" />
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>{formatCurrency(totalReceived)} received</span>
						<span>
							{formatCurrency(totalBookingCost - totalReceived)}{" "}
							pending
						</span>
					</div>
				</div>

				<Separator />

				{/* Payments Received */}
				<div>
					<p className="text-sm font-medium mb-2">
						Payments Received ({paymentsList.length})
					</p>
					{paymentsList.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No payments recorded
						</p>
					) : (
						<ul className="space-y-2">
							{paymentsList.map((payment, i) => (
								<li
									key={i}
									className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
								>
									<div>
										<span className="font-medium">
											{formatCurrency(payment.amount)}
										</span>
										<span className="text-muted-foreground ml-2">
											via{" "}
											{getPaymentMethod(
												payment.paymentMethod,
											)}
										</span>
									</div>
									<span className="text-muted-foreground">
										{formatDate(payment.receivedDate)}
									</span>
								</li>
							))}
						</ul>
					)}
				</div>

				{/* Payment Schedule */}
				{schedulesList.length > 0 && (
					<>
						<Separator />
						<div>
							<p className="text-sm font-medium mb-2">
								Upcoming Payments ({schedulesList.length})
							</p>
							<ul className="space-y-2">
								{schedulesList.map((schedule, i) => (
									<li
										key={i}
										className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
									>
										<div>
											<span className="font-medium">
												{schedule.name}
											</span>
											<span className="text-muted-foreground ml-2">
												{formatCurrency(
													schedule.amount,
												)}
											</span>
										</div>
										<span className="text-muted-foreground">
											Due: {formatDate(schedule.dueDate)}
										</span>
									</li>
								))}
							</ul>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
});

// Deliverables Section - watches: deliverables, packageCost
const DeliverablesSection = memo(function DeliverablesSection({
	onNavigateToStep,
}: {
	onNavigateToStep: (step: BookingTab) => void;
}) {
	const deliverables = useWatch<BookingFormValues, "deliverables">({
		name: "deliverables",
	});
	const packageCost = useWatch<BookingFormValues, "packageCost">({
		name: "packageCost",
	});

	const deliverablesList = deliverables ?? [];
	const packageDeliverables = deliverablesList.filter(
		(d) => d.isPackageIncluded,
	);
	const customDeliverables = deliverablesList.filter(
		(d) => !d.isPackageIncluded,
	);

	// Calculate total custom deliverables cost
	const customDeliverablesCost = customDeliverables.reduce(
		(sum, d) => sum + (Number.parseFloat(d.cost ?? "0") || 0),
		0,
	);
	const packageCostNum = Number.parseFloat(packageCost) || 0;
	const totalBookingCost = packageCostNum + customDeliverablesCost;

	return (
		<Card>
			<SectionHeader
				icon={<PackageIcon className="h-4 w-4" />}
				title="Deliverables"
				count={deliverablesList.length}
				onEdit={() => onNavigateToStep("deliverables")}
			/>
			<CardContent className="space-y-4">
				{deliverablesList.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No deliverables defined
					</p>
				) : (
					<>
						{/* Package Deliverables */}
						{packageDeliverables.length > 0 && (
							<div>
								<p className="text-sm font-medium mb-2 flex items-center gap-2">
									<Badge variant="default">Package</Badge>
									{packageDeliverables.length} deliverable
									{packageDeliverables.length !== 1 && "s"}
								</p>
								<div className="grid gap-2 md:grid-cols-2">
									{packageDeliverables.map((d, i) => (
										<div
											key={i}
											className="p-3 bg-primary/5 border-primary/20 border rounded-lg"
										>
											<div className="flex items-center justify-between">
												<p className="font-medium">
													{d.name}
												</p>
												{(d.quantity ?? 1) > 1 && (
													<Badge
														variant="outline"
														className="text-xs"
													>
														x{d.quantity ?? 1}
													</Badge>
												)}
											</div>
											<p className="text-sm text-muted-foreground">
												{d.deliverableType
													? getDeliverableType(
															d.deliverableType,
														)
													: "—"}
											</p>
											{d.dueDate && (
												<p className="text-xs text-muted-foreground mt-1">
													Due: {formatDate(d.dueDate)}
												</p>
											)}
										</div>
									))}
								</div>
							</div>
						)}

						{/* Custom Deliverables */}
						{customDeliverables.length > 0 && (
							<div>
								<p className="text-sm font-medium mb-2 flex items-center gap-2">
									<Badge variant="secondary">Custom</Badge>
									{customDeliverables.length} deliverable
									{customDeliverables.length !== 1 && "s"}
								</p>
								<div className="grid gap-2 md:grid-cols-2">
									{customDeliverables.map((d, i) => (
										<div
											key={i}
											className="p-3 bg-muted/50 rounded-lg"
										>
											<div className="flex items-center justify-between">
												<p className="font-medium">
													{d.name}
												</p>
												<div className="flex items-center gap-2">
													{(d.quantity ?? 1) > 1 && (
														<Badge
															variant="outline"
															className="text-xs"
														>
															x{d.quantity ?? 1}
														</Badge>
													)}
													{d.cost &&
														Number.parseFloat(
															d.cost,
														) > 0 && (
															<span className="text-sm font-medium text-primary">
																{formatCurrency(
																	d.cost,
																)}
															</span>
														)}
												</div>
											</div>
											<p className="text-sm text-muted-foreground">
												{d.deliverableType
													? getDeliverableType(
															d.deliverableType,
														)
													: "—"}
											</p>
											{d.dueDate && (
												<p className="text-xs text-muted-foreground mt-1">
													Due: {formatDate(d.dueDate)}
												</p>
											)}
										</div>
									))}
								</div>
							</div>
						)}

						{/* Cost Summary */}
						{customDeliverablesCost > 0 && (
							<>
								<Separator />
								<div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">
											Package Cost
										</span>
										<span>
											{formatCurrency(packageCostNum)}
										</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">
											Custom Deliverables
										</span>
										<span>
											{formatCurrency(
												customDeliverablesCost,
											)}
										</span>
									</div>
									<Separator />
									<div className="flex justify-between font-medium">
										<span>Total Booking Cost</span>
										<span className="text-primary text-lg">
											{formatCurrency(totalBookingCost)}
										</span>
									</div>
								</div>
							</>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
});

// ============================================================================
// Main Component
// ============================================================================

interface BookingReviewStepProps {
	onNavigateToStep: (step: BookingTab) => void;
	className?: string;
}

/**
 * Review step - shows full booking summary with edit buttons
 * Allows users to review all data before submission
 *
 * Optimized: Each section only re-renders when its specific data changes,
 * not when any form field changes (uses useWatch with specific field names).
 */
export function BookingReviewStep({
	onNavigateToStep,
	className,
}: BookingReviewStepProps) {
	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div>
				<h3 className="text-lg font-semibold">Review Your Booking</h3>
				<p className="text-sm text-muted-foreground">
					Please review all details before creating the booking
				</p>
			</div>

			<BookingDetailsSection onNavigateToStep={onNavigateToStep} />
			<ParticipantsSection onNavigateToStep={onNavigateToStep} />
			<ShootsSection onNavigateToStep={onNavigateToStep} />
			<PaymentsSection onNavigateToStep={onNavigateToStep} />
			<DeliverablesSection onNavigateToStep={onNavigateToStep} />
		</div>
	);
}
