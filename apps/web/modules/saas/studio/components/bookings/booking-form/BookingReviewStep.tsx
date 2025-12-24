"use client";

import { useFormContext } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";
import { Badge } from "@repo/ui/components/badge";
import { Separator } from "@repo/ui/components/separator";
import {
	UsersIcon,
	CameraIcon,
	PackageIcon,
	WalletIcon,
	CalendarIcon,
	ClipboardListIcon,
	PencilIcon,
	MapPinIcon,
	ClockIcon,
} from "lucide-react";
import { configurationsApi, clientsApi, crewsApi } from "@saas/studio/lib/api";
import type { BookingFormValues, BookingTab } from "./booking-form-schema";
import { SHOOT_TYPE_OPTIONS, DELIVERABLE_TYPE_OPTIONS, PAYMENT_METHOD_OPTIONS } from "./booking-form-schema";

interface BookingReviewStepProps {
	onNavigateToStep: (step: BookingTab) => void;
	className?: string;
}

/**
 * Review step - shows full booking summary with edit buttons
 * Allows users to review all data before submission
 */
export function BookingReviewStep({
	onNavigateToStep,
	className,
}: BookingReviewStepProps) {
	const form = useFormContext<BookingFormValues>();
	const formValues = form.watch();

	// Fetch lookup data
	const { data: bookingTypesData } = useQuery(
		configurationsApi.bookingTypesOptions()
	);
	const { data: packageTypesData } = useQuery(
		configurationsApi.packageTypesOptions()
	);
	const { data: relationTypesData } = useQuery(
		configurationsApi.relationTypesOptions()
	);
	const { data: clientsData } = useQuery(
		clientsApi.listOptions({ limit: 100 })
	);
	const { data: crewsData } = useQuery(crewsApi.listOptions({ limit: 100 }));

	const bookingTypes = bookingTypesData?.data ?? [];
	const packageTypes = packageTypesData?.data ?? [];
	const relationTypes = relationTypesData?.data ?? [];
	const clients = clientsData?.data ?? [];
	const crews = crewsData?.data ?? [];

	// Helper functions
	const formatCurrency = (amount: number | string) => {
		const num = typeof amount === "string" ? parseFloat(amount) || 0 : amount;
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		}).format(num);
	};

	const formatDate = (dateString: string) => {
		if (!dateString) return "—";
		return new Date(dateString).toLocaleDateString("en-IN", {
			weekday: "short",
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	};

	const getClientName = (clientId: string) => {
		return clients.find((c) => c.id === clientId)?.name ?? "Unknown Client";
	};

	const getCrewName = (crewId: string) => {
		return crews.find((c) => c.id === crewId)?.name ?? "Unknown Crew";
	};

	const getRelationType = (key: string) => {
		return relationTypes.find((t) => t.key === key)?.label ?? key;
	};

	const getBookingType = (key: string) => {
		return bookingTypes.find((t) => t.key === key)?.label ?? key;
	};

	const getPackageType = (key: string) => {
		return packageTypes.find((t) => t.key === key)?.label ?? key;
	};

	const getShootType = (key: string) => {
		return SHOOT_TYPE_OPTIONS.find((t) => t.value === key)?.label ?? key;
	};

	const getDeliverableType = (key: string) => {
		return DELIVERABLE_TYPE_OPTIONS.find((t) => t.value === key)?.label ?? key;
	};

	const getPaymentMethod = (key: string) => {
		return PAYMENT_METHOD_OPTIONS.find((t) => t.value === key)?.label ?? key;
	};

	// Calculate totals
	const packageCost = parseFloat(formValues.packageCost) || 0;
	const totalReceived = (formValues.payments ?? []).reduce(
		(sum, p) => sum + (parseFloat(p.amount) || 0),
		0
	);
	const paymentPercentage =
		packageCost > 0 ? Math.min(100, Math.round((totalReceived / packageCost) * 100)) : 0;

	return (
		<div className={cn("space-y-6", className)}>
			{/* Header */}
			<div>
				<h3 className="text-lg font-semibold">Review Your Booking</h3>
				<p className="text-sm text-muted-foreground">
					Please review all details before creating the booking
				</p>
			</div>

			{/* Booking Details Section */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<ClipboardListIcon className="h-4 w-4" />
						Booking Details
					</CardTitle>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onNavigateToStep("details")}
					>
						<PencilIcon className="h-3 w-3 mr-1" />
						Edit
					</Button>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						<div>
							<p className="text-xs text-muted-foreground uppercase tracking-wide">
								Booking Name
							</p>
							<p className="font-medium">{formValues.name || "—"}</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground uppercase tracking-wide">
								Type
							</p>
							<p className="font-medium">
								{formValues.bookingType ? getBookingType(formValues.bookingType) : "—"}
							</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground uppercase tracking-wide">
								Package
							</p>
							<p className="font-medium">
								{formValues.packageType ? getPackageType(formValues.packageType) : "—"}
							</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground uppercase tracking-wide">
								Package Cost
							</p>
							<p className="text-xl font-bold text-primary">
								{formatCurrency(packageCost)}
							</p>
						</div>
					</div>

					{formValues.note && (
						<div>
							<p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
								Notes
							</p>
							<p className="text-sm text-muted-foreground">{formValues.note}</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Participants Section */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<UsersIcon className="h-4 w-4" />
						Participants ({formValues.participants.length})
					</CardTitle>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onNavigateToStep("details")}
					>
						<PencilIcon className="h-3 w-3 mr-1" />
						Edit
					</Button>
				</CardHeader>
				<CardContent>
					{formValues.participants.length === 0 ? (
						<p className="text-sm text-muted-foreground">No participants added</p>
					) : (
						<ul className="space-y-2">
							{formValues.participants.map((p, i) => (
								<li key={i} className="flex items-center gap-2">
									<span className="font-medium">
										{p.clientId ? getClientName(p.clientId) : "—"}
									</span>
									{p.role && (
										<Badge variant="secondary" className="text-xs">
											{getRelationType(p.role)}
										</Badge>
									)}
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>

			{/* Shoots Section */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<CameraIcon className="h-4 w-4" />
						Shoots ({(formValues.shoots ?? []).length})
					</CardTitle>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onNavigateToStep("shoots")}
					>
						<PencilIcon className="h-3 w-3 mr-1" />
						Edit
					</Button>
				</CardHeader>
				<CardContent>
					{(formValues.shoots ?? []).length === 0 ? (
						<p className="text-sm text-muted-foreground">No shoots scheduled</p>
					) : (
						<div className="space-y-4">
							{formValues.shoots?.map((shoot, i) => (
								<div key={i} className="p-3 bg-muted/50 rounded-lg">
									<div className="flex items-start justify-between">
										<div>
											<p className="font-medium">{shoot.name || `Shoot ${i + 1}`}</p>
											<p className="text-sm text-muted-foreground">
												{shoot.shootType ? getShootType(shoot.shootType) : "—"}
											</p>
										</div>
										<Badge variant="outline" className="text-xs">
											<CalendarIcon className="h-3 w-3 mr-1" />
											{formatDate(shoot.shootDate)}
										</Badge>
									</div>
									{(shoot.startTime || shoot.venue) && (
										<div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
											{shoot.startTime && (
												<span className="flex items-center gap-1">
													<ClockIcon className="h-3 w-3" />
													{shoot.startTime}
													{shoot.endTime && ` - ${shoot.endTime}`}
												</span>
											)}
											{shoot.venue && (
												<span className="flex items-center gap-1">
													<MapPinIcon className="h-3 w-3" />
													{shoot.venue}
												</span>
											)}
										</div>
									)}
									{(shoot.crewAssignments?.length ?? 0) > 0 && (
										<div className="mt-2 flex flex-wrap gap-1">
											{shoot.crewAssignments?.map((crew, j) => (
												<Badge key={j} variant="secondary" className="text-xs">
													{crew.crewId ? getCrewName(crew.crewId) : "—"}
													{crew.isLead && " (Lead)"}
												</Badge>
											))}
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Payments Section */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<WalletIcon className="h-4 w-4" />
						Payments
					</CardTitle>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onNavigateToStep("payments")}
					>
						<PencilIcon className="h-3 w-3 mr-1" />
						Edit
					</Button>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Payment Progress */}
					<div className="space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">Payment Progress</span>
							<span className="font-medium">{paymentPercentage}%</span>
						</div>
						<Progress value={paymentPercentage} className="h-2" />
						<div className="flex justify-between text-xs text-muted-foreground">
							<span>{formatCurrency(totalReceived)} received</span>
							<span>{formatCurrency(packageCost - totalReceived)} pending</span>
						</div>
					</div>

					<Separator />

					{/* Payments Received */}
					<div>
						<p className="text-sm font-medium mb-2">
							Payments Received ({(formValues.payments ?? []).length})
						</p>
						{(formValues.payments ?? []).length === 0 ? (
							<p className="text-sm text-muted-foreground">No payments recorded</p>
						) : (
							<ul className="space-y-2">
								{formValues.payments?.map((payment, i) => (
									<li
										key={i}
										className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
									>
										<div>
											<span className="font-medium">
												{formatCurrency(payment.amount)}
											</span>
											<span className="text-muted-foreground ml-2">
												via {getPaymentMethod(payment.paymentMethod)}
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
					{(formValues.paymentSchedules ?? []).length > 0 && (
						<>
							<Separator />
							<div>
								<p className="text-sm font-medium mb-2">
									Upcoming Payments ({formValues.paymentSchedules?.length})
								</p>
								<ul className="space-y-2">
									{formValues.paymentSchedules?.map((schedule, i) => (
										<li
											key={i}
											className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
										>
											<div>
												<span className="font-medium">{schedule.name}</span>
												<span className="text-muted-foreground ml-2">
													{formatCurrency(schedule.amount)}
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

			{/* Deliverables Section */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<PackageIcon className="h-4 w-4" />
						Deliverables ({(formValues.deliverables ?? []).length})
					</CardTitle>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onNavigateToStep("deliverables")}
					>
						<PencilIcon className="h-3 w-3 mr-1" />
						Edit
					</Button>
				</CardHeader>
				<CardContent>
					{(formValues.deliverables ?? []).length === 0 ? (
						<p className="text-sm text-muted-foreground">No deliverables defined</p>
					) : (
						<div className="grid gap-2 md:grid-cols-2">
							{formValues.deliverables?.map((d, i) => (
								<div key={i} className="p-3 bg-muted/50 rounded-lg">
									<p className="font-medium">{d.name}</p>
									<p className="text-sm text-muted-foreground">
										{d.deliverableType ? getDeliverableType(d.deliverableType) : "—"}
									</p>
									{d.dueDate && (
										<p className="text-xs text-muted-foreground mt-1">
											Due: {formatDate(d.dueDate)}
										</p>
									)}
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
