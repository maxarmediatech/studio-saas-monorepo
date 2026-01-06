"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/accordion";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import {
	FieldDescription,
	FieldLegend,
	FieldSeparator,
} from "@repo/ui/components/field";
import { Progress } from "@repo/ui/components/progress";
import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
	AlertCircleIcon,
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
import { memo, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { bookingFormQueries } from "./booking-form-queries";
import type { BookingFormValues, BookingTab } from "./booking-form-schema";
import { PAYMENT_METHOD_OPTIONS } from "./booking-form-schema";

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

const formatDate = (dateString: string) => {
	if (!dateString) {
		return "—";
	}
	return new Date(dateString).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
};

const getInitials = (name: string): string => {
	if (!name) {
		return "?";
	}
	const words = name.trim().split(/\s+/);
	if (words.length === 1) {
		return words[0].substring(0, 2).toUpperCase();
	}
	return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

// ============================================================================
// Validation Warnings
// ============================================================================

interface ValidationWarning {
	id: string;
	message: string;
	step: BookingTab;
}

function useValidationWarnings(): ValidationWarning[] {
	const { control } = useFormContext<BookingFormValues>();
	const [name, participants, bookingType, packageType] = useWatch({
		control,
		name: ["name", "participants", "bookingType", "packageType"],
	});

	return useMemo(() => {
		const warnings: ValidationWarning[] = [];
		if (!name?.trim()) {
			warnings.push({
				id: "name",
				message: "Booking name is required",
				step: "details",
			});
		}
		if (!participants || participants.length === 0) {
			warnings.push({
				id: "clients",
				message: "At least one client is required",
				step: "details",
			});
		}
		if (!bookingType) {
			warnings.push({
				id: "type",
				message: "Booking type is required",
				step: "details",
			});
		}
		if (!packageType) {
			warnings.push({
				id: "package",
				message: "Package is required",
				step: "details",
			});
		}
		return warnings;
	}, [name, participants, bookingType, packageType]);
}

// ============================================================================
// Section Components
// ============================================================================

const BookingDetailsSection = memo(function BookingDetailsSection({
	onEdit,
}: {
	onEdit: () => void;
}) {
	// Details watches
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

	// Clients watches
	const participants = useWatch<BookingFormValues, "participants">({
		name: "participants",
	});

	// Queries for both sections
	const { data: bookingTypesData } = useQuery(
		bookingFormQueries.bookingTypes(),
	);
	const { data: packageTypesData } = useQuery(
		bookingFormQueries.packageTypes(),
	);
	const { data: clientsData } = useQuery(bookingFormQueries.clients());
	const { data: relationTypesData } = useQuery(
		bookingFormQueries.relationTypes(),
	);

	// Lookup helpers
	const getBookingType = (key: string) =>
		bookingTypesData?.data?.find((t) => t.key === key)?.label ?? key;
	const getPackageType = (key: string) =>
		packageTypesData?.data?.find((t) => t.key === key)?.label ?? key;
	const getClientName = (clientId: string) =>
		clientsData?.data?.find((c) => c.id === clientId)?.name ?? "Unknown";
	const getRelationType = (key: string) =>
		relationTypesData?.data?.find((t) => t.key === key)?.label ?? key;

	// Combined subtitle: "Wedding • ₹50,000 • 2 clients"
	const clientCount = participants?.length ?? 0;
	const isComplete = name && packageType;
	const subtitle = isComplete
		? `${getPackageType(packageType)} • ${formatCurrency(packageCost)} • ${clientCount} client${clientCount !== 1 ? "s" : ""}`
		: "Incomplete";

	return (
		<AccordionItem value="details" className="border-none">
			<div className="overflow-hidden rounded-lg border bg-muted/10">
				<div className="flex items-center px-4 py-3">
					<AccordionTrigger
						chevronPosition="start"
						className="flex-1 p-0 hover:no-underline"
					>
						<div className="flex flex-col items-start gap-0.5">
							<span className="flex items-center gap-2 text-sm font-medium">
								<ClipboardListIcon className="h-4 w-4 text-muted-foreground" />
								Booking Details
							</span>
							<span className="text-xs text-muted-foreground">
								{subtitle}
							</span>
						</div>
					</AccordionTrigger>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 ml-auto"
						onClick={onEdit}
					>
						<PencilIcon className="h-3 w-3 mr-1" />
						Edit
					</Button>
				</div>
				<AccordionContent className="px-4 pb-4 pt-0">
					{/* Booking details grid */}
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t pt-4">
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
								{bookingType
									? getBookingType(bookingType)
									: "—"}
							</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground uppercase tracking-wide">
								Package
							</p>
							<p className="font-medium">
								{packageType
									? getPackageType(packageType)
									: "—"}
							</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground uppercase tracking-wide">
								Package Cost
							</p>
							<p className="text-lg font-semibold">
								{formatCurrency(packageCost)}
							</p>
						</div>
					</div>

					{/* Notes (optional) */}
					{note && (
						<div className="mt-3 pt-3 border-t">
							<p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
								Notes
							</p>
							<p className="text-sm text-muted-foreground">
								{note}
							</p>
						</div>
					)}

					{/* Clients section */}
					<div className="mt-4 pt-4 border-t">
						<p className="text-sm font-medium mb-3">Clients</p>
						{!participants || participants.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No clients added
							</p>
						) : (
							<div className="flex flex-wrap gap-2">
								{participants.map((p, i) => {
									const clientName = p.clientId
										? getClientName(p.clientId)
										: "—";
									return (
										<div
											key={i}
											className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2"
										>
											<Avatar className="h-7 w-7">
												<AvatarFallback className="text-xs">
													{getInitials(clientName)}
												</AvatarFallback>
											</Avatar>
											<div className="flex flex-col">
												<span className="text-sm font-medium">
													{clientName}
												</span>
												{p.role && (
													<span className="text-xs text-muted-foreground">
														{getRelationType(
															p.role,
														)}
													</span>
												)}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</AccordionContent>
			</div>
		</AccordionItem>
	);
});

const ShootsSection = memo(function ShootsSection({
	onEdit,
}: {
	onEdit: () => void;
}) {
	const shoots = useWatch<BookingFormValues, "shoots">({ name: "shoots" });
	const { data: crewsData } = useQuery(bookingFormQueries.crews());
	const { data: eventTypesData } = useQuery(bookingFormQueries.eventTypes());

	const getCrewName = (crewId: string) =>
		crewsData?.data?.find((c) => c.id === crewId)?.name ?? "Unknown";
	const getEventType = (key: string) =>
		eventTypesData?.data?.find((t) => t.key === key)?.label ?? key;

	const shootsList = shoots ?? [];

	return (
		<AccordionItem value="shoots" className="border-none">
			<div className="overflow-hidden rounded-lg border bg-muted/10">
				<div className="flex items-center px-4 py-3">
					<AccordionTrigger
						chevronPosition="start"
						className="flex-1 p-0 hover:no-underline"
					>
						<div className="flex flex-col items-start gap-0.5">
							<span className="flex items-center gap-2 text-sm font-medium">
								<CameraIcon className="h-4 w-4 text-muted-foreground" />
								Shoots ({shootsList.length})
							</span>
							<span className="text-xs text-muted-foreground">
								{shootsList.length === 0
									? "No shoots scheduled"
									: `${shootsList.length} shoot${shootsList.length !== 1 ? "s" : ""} scheduled`}
							</span>
						</div>
					</AccordionTrigger>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 ml-auto"
						onClick={onEdit}
					>
						<PencilIcon className="h-3 w-3 mr-1" />
						Edit
					</Button>
				</div>
				<AccordionContent className="px-4 pb-4 pt-0">
					<div className="border-t pt-4">
						{shootsList.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No shoots scheduled
							</p>
						) : (
							<div className="space-y-3">
								{shootsList.map((shoot, i) => (
									<div
										key={i}
										className="rounded-lg border bg-background p-3"
									>
										<div className="flex items-start justify-between gap-2">
											<span className="font-medium">
												{shoot.shootType
													? getEventType(
															shoot.shootType,
														)
													: `Shoot ${i + 1}`}
											</span>
											<span className="text-sm text-muted-foreground flex items-center gap-1">
												<CalendarIcon className="h-3 w-3" />
												{formatDate(shoot.shootDate)}
											</span>
										</div>
										{(shoot.startTime ||
											shoot.location) && (
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
										{(shoot.crewAssignments?.length ?? 0) >
											0 && (
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
															{crew.rate && (
																<span className="ml-1 text-muted-foreground">
																	₹
																	{Number(
																		crew.rate,
																	).toLocaleString()}
																</span>
															)}
														</Badge>
													),
												)}
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				</AccordionContent>
			</div>
		</AccordionItem>
	);
});

const DeliverablesSection = memo(function DeliverablesSection({
	onEdit,
}: {
	onEdit: () => void;
}) {
	const deliverables = useWatch<BookingFormValues, "deliverables">({
		name: "deliverables",
	});

	const deliverablesList = deliverables ?? [];
	const packageCount = deliverablesList.filter(
		(d) => d.isPackageIncluded,
	).length;
	const customCount = deliverablesList.filter(
		(d) => !d.isPackageIncluded,
	).length;

	return (
		<AccordionItem value="deliverables" className="border-none">
			<div className="overflow-hidden rounded-lg border bg-muted/10">
				<div className="flex items-center px-4 py-3">
					<AccordionTrigger
						chevronPosition="start"
						className="flex-1 p-0 hover:no-underline"
					>
						<div className="flex flex-col items-start gap-0.5">
							<span className="flex items-center gap-2 text-sm font-medium">
								<PackageIcon className="h-4 w-4 text-muted-foreground" />
								Deliverables ({deliverablesList.length})
							</span>
							<span className="text-xs text-muted-foreground">
								{deliverablesList.length === 0
									? "No deliverables defined"
									: `${packageCount} package, ${customCount} custom`}
							</span>
						</div>
					</AccordionTrigger>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 ml-auto"
						onClick={onEdit}
					>
						<PencilIcon className="h-3 w-3 mr-1" />
						Edit
					</Button>
				</div>
				<AccordionContent className="px-4 pb-4 pt-0">
					<div className="border-t pt-4">
						{deliverablesList.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No deliverables defined
							</p>
						) : (
							<div className="space-y-2">
								{deliverablesList.map((d, i) => (
									<div
										key={i}
										className={cn(
											"flex items-center justify-between rounded-lg border px-3 py-2",
											d.isPackageIncluded
												? "bg-background"
												: "bg-muted/30",
										)}
									>
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium">
												{d.name}
											</span>
											{(d.quantity ?? 1) > 1 && (
												<Badge
													variant="outline"
													className="text-xs"
												>
													×{d.quantity}
												</Badge>
											)}
											{d.isPackageIncluded && (
												<Badge
													variant="secondary"
													className="text-xs"
												>
													Package
												</Badge>
											)}
										</div>
										{!d.isPackageIncluded && d.cost && (
											<span className="text-sm font-medium">
												{formatCurrency(d.cost)}
											</span>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				</AccordionContent>
			</div>
		</AccordionItem>
	);
});

const PaymentsSection = memo(function PaymentsSection({
	onEdit,
}: {
	onEdit: () => void;
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
	const customDeliverablesCost = (deliverables ?? [])
		.filter((d) => !d.isPackageIncluded)
		.reduce((sum, d) => sum + (Number.parseFloat(d.cost ?? "0") || 0), 0);
	const totalCost = packageCostNum + customDeliverablesCost;

	const totalReceived = (payments ?? []).reduce(
		(sum, p) => sum + (Number.parseFloat(p.amount) || 0),
		0,
	);
	const paymentPercentage =
		totalCost > 0
			? Math.min(100, Math.round((totalReceived / totalCost) * 100))
			: 0;

	const getPaymentMethod = (key: string) =>
		PAYMENT_METHOD_OPTIONS.find((t) => t.value === key)?.label ?? key;

	return (
		<AccordionItem value="payments" className="border-none">
			<div className="overflow-hidden rounded-lg border bg-muted/10">
				<div className="flex items-center px-4 py-3">
					<AccordionTrigger
						chevronPosition="start"
						className="flex-1 p-0 hover:no-underline"
					>
						<div className="flex flex-col items-start gap-0.5">
							<span className="flex items-center gap-2 text-sm font-medium">
								<WalletIcon className="h-4 w-4 text-muted-foreground" />
								Payments ({(payments ?? []).length})
							</span>
							<span className="text-xs text-muted-foreground">
								{paymentPercentage}% paid •{" "}
								{(paymentSchedules ?? []).length} scheduled
							</span>
						</div>
					</AccordionTrigger>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 ml-auto"
						onClick={onEdit}
					>
						<PencilIcon className="h-3 w-3 mr-1" />
						Edit
					</Button>
				</div>
				<AccordionContent className="px-4 pb-4 pt-0">
					<div className="border-t pt-4 space-y-4">
						{/* Progress bar */}
						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">
									Progress
								</span>
								<span className="font-medium">
									{paymentPercentage}%
								</span>
							</div>
							<Progress
								value={paymentPercentage}
								className="h-2"
							/>
							<div className="flex justify-between text-xs text-muted-foreground">
								<span>
									{formatCurrency(totalReceived)} received
								</span>
								<span>
									{formatCurrency(totalCost - totalReceived)}{" "}
									remaining
								</span>
							</div>
						</div>

						{/* Payment list */}
						{(payments ?? []).length > 0 && (
							<div className="space-y-2">
								<p className="text-sm font-medium">
									Payments Received ({payments?.length})
								</p>
								{payments?.map((p, i) => (
									<div
										key={i}
										className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm"
									>
										<div>
											<span className="font-medium">
												{formatCurrency(p.amount)}
											</span>
											<span className="text-muted-foreground ml-2">
												via{" "}
												{getPaymentMethod(
													p.paymentMethod,
												)}
											</span>
										</div>
										<span className="text-muted-foreground">
											{formatDate(p.receivedDate)}
										</span>
									</div>
								))}
							</div>
						)}

						{/* Scheduled payments */}
						{(paymentSchedules ?? []).length > 0 && (
							<div className="space-y-2">
								<p className="text-sm font-medium">
									Scheduled Milestones (
									{paymentSchedules?.length})
								</p>
								{paymentSchedules?.map((s, i) => (
									<div
										key={i}
										className="flex items-center justify-between rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm"
									>
										<span className="font-medium">
											{formatCurrency(s.amount)}
										</span>
										<span className="text-muted-foreground">
											Due {formatDate(s.dueDate)}
										</span>
									</div>
								))}
							</div>
						)}
					</div>
				</AccordionContent>
			</div>
		</AccordionItem>
	);
});

// ============================================================================
// Main Component
// ============================================================================

interface BookingReviewStepProps {
	onNavigateToStep: (step: BookingTab) => void;
	className?: string;
}

export function BookingReviewStep({
	onNavigateToStep,
	className,
}: BookingReviewStepProps) {
	const warnings = useValidationWarnings();

	return (
		<Card className={cn("shadow-none", className)}>
			<CardContent className="p-6 space-y-4">
				<FieldLegend>Review Booking</FieldLegend>
				<FieldDescription>
					Review your booking details before submission
				</FieldDescription>

				{/* Validation warnings */}
				{warnings.length > 0 && (
					<Alert variant="destructive">
						<AlertCircleIcon className="h-4 w-4" />
						<AlertDescription>
							<ul className="space-y-1">
								{warnings.map((w) => (
									<li
										key={w.id}
										className="flex items-center justify-between"
									>
										<span className="text-sm">
											{w.message}
										</span>
										<Button
											type="button"
											variant="link"
											size="sm"
											className="h-auto p-0 text-destructive-foreground underline"
											onClick={() =>
												onNavigateToStep(w.step)
											}
										>
											Fix
										</Button>
									</li>
								))}
							</ul>
						</AlertDescription>
					</Alert>
				)}

				<FieldSeparator />

				{/* Accordion sections */}
				<Accordion
					type="multiple"
					defaultValue={["details"]}
					className="mt-2 space-y-3"
				>
					<BookingDetailsSection
						onEdit={() => onNavigateToStep("details")}
					/>
					<PaymentsSection
						onEdit={() => onNavigateToStep("payments")}
					/>
					<ShootsSection onEdit={() => onNavigateToStep("shoots")} />
					<DeliverablesSection
						onEdit={() => onNavigateToStep("deliverables")}
					/>
				</Accordion>
			</CardContent>
		</Card>
	);
}
