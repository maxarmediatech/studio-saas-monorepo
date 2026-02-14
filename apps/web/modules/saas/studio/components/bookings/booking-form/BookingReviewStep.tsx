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
import { FieldLabel, FieldLegend, FieldSet } from "@repo/ui/components/field";
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
	WalletIcon,
} from "lucide-react";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
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
// Section Components (receive data as props)
// ============================================================================

interface BookingDetailsSectionProps {
	onEdit: () => void;
	name: string;
	bookingType: string;
	packageType: string;
	packageCost: string;
	note?: string;
	participants: BookingFormValues["participants"];
}

function BookingDetailsSection({
	onEdit,
	name,
	bookingType,
	packageType,
	packageCost,
	note,
	participants,
}: BookingDetailsSectionProps) {
	// Queries for lookups
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

	// Combined subtitle
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
				<AccordionContent className="pb-4 pt-0">
					{/* Booking details grid */}
					<div className="pl-14 pr-20 grid gap-4 grid-cols-1 sm:grid-cols-2 pt-3">
						<div>
							<FieldLabel className="text-xs">
								Booking Name
							</FieldLabel>
							<p className="text-sm font-medium mt-1">
								{name || "—"}
							</p>
						</div>
						<div>
							<FieldLabel className="text-xs">Type</FieldLabel>
							<p className="text-sm font-medium mt-1">
								{bookingType
									? getBookingType(bookingType)
									: "—"}
							</p>
						</div>
						<div>
							<FieldLabel className="text-xs">Package</FieldLabel>
							<p className="text-sm font-medium mt-1">
								{packageType
									? getPackageType(packageType)
									: "—"}
							</p>
						</div>
						<div>
							<FieldLabel className="text-xs">
								Package Cost
							</FieldLabel>
							<p className="text-sm font-medium mt-1">
								{formatCurrency(packageCost)}
							</p>
						</div>
					</div>

					{/* Notes (optional) */}
					{note && (
						<div className="mt-4 pl-14 pr-20">
							<FieldLabel className="text-xs mb-1">
								Notes
							</FieldLabel>
							<p className="text-sm text-muted-foreground">
								{note}
							</p>
						</div>
					)}

					{/* Clients section */}
					<div className="mt-4 pl-14 pr-20">
						<FieldLabel className="text-xs mb-2">
							Clients
						</FieldLabel>
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
}

interface ShootsSectionProps {
	onEdit: () => void;
	shoots: BookingFormValues["shoots"];
}

function ShootsSection({ onEdit, shoots }: ShootsSectionProps) {
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
				<AccordionContent className="pb-4 pt-0">
					<div className="pl-14 pr-20 pt-3">
						{shootsList.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No shoots scheduled
							</p>
						) : (
							<div className="space-y-2">
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
}

interface DeliverablesSectionProps {
	onEdit: () => void;
	deliverables: BookingFormValues["deliverables"];
}

function DeliverablesSection({
	onEdit,
	deliverables,
}: DeliverablesSectionProps) {
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
				<AccordionContent className="pb-4 pt-0">
					<div className="pl-14 pr-20 pt-3">
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
}

interface PaymentsSectionProps {
	onEdit: () => void;
	packageCost: string;
	payments: BookingFormValues["payments"];
	paymentSchedules: BookingFormValues["paymentSchedules"];
	deliverables: BookingFormValues["deliverables"];
}

function PaymentsSection({
	onEdit,
	packageCost,
	payments,
	paymentSchedules,
	deliverables,
}: PaymentsSectionProps) {
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
				<AccordionContent className="pb-4 pt-0">
					<div className="pl-14 pr-20 pt-3 space-y-4">
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
								<FieldLabel className="text-xs">
									Payments Received ({payments?.length})
								</FieldLabel>
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
								<FieldLabel className="text-xs">
									Scheduled Milestones (
									{paymentSchedules?.length})
								</FieldLabel>
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
}

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
	// Get form and watch ALL values at this level
	const form = useFormContext<BookingFormValues>();

	// Watch all form values - this triggers re-render on ANY form change
	const formValues = form.watch();

	// Compute validation warnings
	const warnings = useMemo(() => {
		const result: Array<{ id: string; message: string; step: BookingTab }> =
			[];
		if (!formValues.name?.trim()) {
			result.push({
				id: "name",
				message: "Booking name is required",
				step: "details",
			});
		}
		if (!formValues.participants || formValues.participants.length === 0) {
			result.push({
				id: "clients",
				message: "At least one client is required",
				step: "details",
			});
		}
		if (!formValues.bookingType) {
			result.push({
				id: "type",
				message: "Booking type is required",
				step: "details",
			});
		}
		if (!formValues.packageType) {
			result.push({
				id: "package",
				message: "Package is required",
				step: "details",
			});
		}
		return result;
	}, [
		formValues.name,
		formValues.participants,
		formValues.bookingType,
		formValues.packageType,
	]);

	return (
		<div className={cn("space-y-4", className)}>
			<FieldSet className="gap-1">
				<FieldLegend className="mb-0">Review Booking</FieldLegend>
			</FieldSet>
			<Card>
				<CardContent className="space-y-4">
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

					{/* Accordion sections - pass watched values as props */}
					<Accordion
						type="multiple"
						defaultValue={["details"]}
						className="mt-2 space-y-3"
					>
						<BookingDetailsSection
							onEdit={() => onNavigateToStep("details")}
							name={formValues.name}
							bookingType={formValues.bookingType}
							packageType={formValues.packageType}
							packageCost={formValues.packageCost}
							note={formValues.note}
							participants={formValues.participants}
						/>
						<ShootsSection
							onEdit={() => onNavigateToStep("shoots")}
							shoots={formValues.shoots}
						/>
						<DeliverablesSection
							onEdit={() => onNavigateToStep("deliverables")}
							deliverables={formValues.deliverables}
						/>
						<PaymentsSection
							onEdit={() => onNavigateToStep("payments")}
							packageCost={formValues.packageCost}
							payments={formValues.payments}
							paymentSchedules={formValues.paymentSchedules}
							deliverables={formValues.deliverables}
						/>
					</Accordion>
				</CardContent>
			</Card>
		</div>
	);
}
