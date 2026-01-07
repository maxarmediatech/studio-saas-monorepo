"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/accordion";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { PageContent } from "@saas/studio";
import {
	useDeliverableParams,
	usePaymentParams,
	useShootParams,
} from "@saas/studio/hooks/params";
import {
	bookingsApi,
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
	ClipboardListIcon,
	ClockIcon,
	MailIcon,
	MapPinIcon,
	PackageIcon,
	PencilIcon,
	PhoneIcon,
	PlusIcon,
	UserIcon,
	WalletIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface BookingDetailPageClientProps {
	organizationSlug: string;
	bookingId: string;
}

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

const formatDate = (dateString: string | Date) => {
	if (!dateString) return "-";
	return format(new Date(dateString), "MMM d, yyyy");
};

const getInitials = (name: string): string => {
	if (!name) return "?";
	const words = name.trim().split(/\s+/);
	if (words.length === 1) {
		return words[0].substring(0, 2).toUpperCase();
	}
	return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const statusColors: Record<string, { bg: string; text: string }> = {
	new: { bg: "bg-yellow-100", text: "text-yellow-800" },
	preparation: { bg: "bg-blue-100", text: "text-blue-800" },
	shooting: { bg: "bg-purple-100", text: "text-purple-800" },
	delivery: { bg: "bg-orange-100", text: "text-orange-800" },
	completed: { bg: "bg-green-100", text: "text-green-800" },
	cancelled: { bg: "bg-gray-100", text: "text-gray-800" },
};

// ============================================================================
// Hero Card Component
// ============================================================================

interface HeroCardProps {
	packageCost: string;
	totalReceived: string;
	balance: string;
	isLoading?: boolean;
}

function HeroCard({
	packageCost,
	totalReceived,
	balance,
	isLoading,
}: HeroCardProps) {
	if (isLoading) {
		return (
			<Card>
				<CardContent className="pt-6">
					<div className="grid grid-cols-3 gap-4">
						{[1, 2, 3].map((i) => (
							<div key={i} className="space-y-2">
								<Skeleton className="h-4 w-20" />
								<Skeleton className="h-8 w-28" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardContent className="pt-6">
				<div className="grid grid-cols-3 gap-4">
					<div className="space-y-1">
						<p className="text-sm text-muted-foreground">Package Cost</p>
						<p className="text-2xl font-bold">{formatCurrency(packageCost)}</p>
					</div>
					<div className="space-y-1">
						<p className="text-sm text-muted-foreground">Received</p>
						<p className="text-2xl font-bold text-green-600">
							{formatCurrency(totalReceived)}
						</p>
					</div>
					<div className="space-y-1">
						<p className="text-sm text-muted-foreground">Balance</p>
						<p
							className={cn(
								"text-2xl font-bold",
								Number.parseFloat(balance) > 0
									? "text-amber-600"
									: "text-green-600",
							)}
						>
							{formatCurrency(balance)}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Overview Section Component
// ============================================================================

interface OverviewSectionProps {
	booking: {
		bookingType: string | null;
		packageType: string | null;
		note: string | null;
		createdAt: Date | string;
		participants: Array<{
			role: string;
			client: {
				id: string;
				name: string;
				email: string | null;
				phoneNumber: string | null;
			};
		}>;
		events: Array<{
			eventType: string;
			eventDate: Date | string;
			venue: string | null;
		}>;
	};
	onEdit: () => void;
}

function OverviewSection({ booking, onEdit }: OverviewSectionProps) {
	const clientCount = booking.participants?.length ?? 0;
	const eventCount = booking.events?.length ?? 0;

	return (
		<AccordionItem value="overview" className="border-none">
			<div className="overflow-hidden rounded-lg border bg-muted/10">
				<div className="flex items-center px-4 py-3">
					<AccordionTrigger
						chevronPosition="start"
						className="flex-1 p-0 hover:no-underline"
					>
						<div className="flex flex-col items-start gap-0.5">
							<span className="flex items-center gap-2 text-sm font-medium">
								<ClipboardListIcon className="h-4 w-4 text-muted-foreground" />
								Overview
								{(clientCount > 0 || eventCount > 0) && (
									<Badge variant="secondary" className="text-xs ml-1">
										{clientCount} client{clientCount !== 1 ? "s" : ""}
										{eventCount > 0 && `, ${eventCount} event${eventCount !== 1 ? "s" : ""}`}
									</Badge>
								)}
							</span>
							<span className="text-xs text-muted-foreground">
								Clients, events, and notes
							</span>
						</div>
					</AccordionTrigger>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 ml-auto"
						onClick={onEdit}
						aria-label="Edit overview"
					>
						<PencilIcon className="h-3 w-3 mr-1" />
						Edit
					</Button>
				</div>
				<AccordionContent className="pb-4 pt-0">
					<div className="pl-10 pr-4 pt-3 space-y-6">
						{/* Clients Section */}
						<div>
							<h4 className="text-sm font-medium mb-3 flex items-center gap-2">
								<UserIcon className="h-4 w-4 text-muted-foreground" />
								Clients
							</h4>
							{booking.participants.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No clients added
								</p>
							) : (
								<div className="space-y-3">
									{booking.participants.map((participant) => (
										<div key={participant.client.id} className="flex items-start gap-3">
											<Avatar className="h-10 w-10">
												<AvatarFallback>
													{getInitials(participant.client.name)}
												</AvatarFallback>
											</Avatar>
											<div className="flex-1 space-y-1">
												<div className="flex items-center gap-2">
													<p className="font-medium">
														{participant.client.name}
													</p>
													<Badge variant="secondary" className="text-xs">
														{participant.role}
													</Badge>
												</div>
												<div className="space-y-0.5 text-sm text-muted-foreground">
													{participant.client.email && (
														<div className="flex items-center gap-1.5">
															<MailIcon className="h-3.5 w-3.5" />
															<span>{participant.client.email}</span>
														</div>
													)}
													{participant.client.phoneNumber && (
														<div className="flex items-center gap-1.5">
															<PhoneIcon className="h-3.5 w-3.5" />
															<span>{participant.client.phoneNumber}</span>
														</div>
													)}
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Events Section */}
						{booking.events.length > 0 && (
							<div>
								<h4 className="text-sm font-medium mb-3 flex items-center gap-2">
									<CalendarIcon className="h-4 w-4 text-muted-foreground" />
									Events
								</h4>
								<div className="space-y-3">
									{booking.events.map((event) => (
										<div
											key={`${event.eventType}-${event.eventDate}`}
											className="flex items-start justify-between gap-4 rounded-lg border bg-background p-3"
										>
											<div className="space-y-1">
												<p className="font-medium">{event.eventType}</p>
												{event.venue && (
													<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
														<MapPinIcon className="h-3.5 w-3.5" />
														<span>{event.venue}</span>
													</div>
												)}
											</div>
											<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
												<CalendarIcon className="h-3.5 w-3.5" />
												<span>{formatDate(event.eventDate)}</span>
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Notes Section */}
						{booking.note && (
							<div>
								<h4 className="text-sm font-medium mb-2">Notes</h4>
								<p className="text-sm text-muted-foreground">{booking.note}</p>
							</div>
						)}

						{/* Booking Details */}
						<div className="grid grid-cols-2 gap-4 pt-2 border-t">
							<div className="space-y-1">
								<p className="text-xs text-muted-foreground">Booking Type</p>
								<p className="text-sm font-medium">
									{booking.bookingType || "-"}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-xs text-muted-foreground">Package Type</p>
								<p className="text-sm font-medium">
									{booking.packageType || "-"}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-xs text-muted-foreground">Created</p>
								<p className="text-sm font-medium">
									{formatDate(booking.createdAt)}
								</p>
							</div>
						</div>
					</div>
				</AccordionContent>
			</div>
		</AccordionItem>
	);
}

// ============================================================================
// Shoots Section Component
// ============================================================================

interface ShootsSectionProps {
	bookingId: string;
}

function ShootsSection({ bookingId }: ShootsSectionProps) {
	const { openCreate, openEdit } = useShootParams();

	const { data: shoots, isLoading, isError, refetch } = useQuery({
		...shootsApi.listOptions({ bookingId, limit: 50 }),
		enabled: !!bookingId,
	});

	const shootsList = shoots?.data ?? [];
	const count = shootsList.length;

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
								Shoots
								<Badge variant="secondary" className="text-xs ml-1">
									{count}
								</Badge>
							</span>
							<span className="text-xs text-muted-foreground">
								{isLoading
									? "Loading..."
									: count === 0
										? "No shoots scheduled"
										: `${count} shoot${count !== 1 ? "s" : ""} scheduled`}
							</span>
						</div>
					</AccordionTrigger>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 ml-auto"
						onClick={() => openCreate()}
						aria-label="Add shoot"
					>
						<PlusIcon className="h-3 w-3 mr-1" />
						Add
					</Button>
				</div>
				<AccordionContent className="pb-4 pt-0">
					<div className="pl-10 pr-4 pt-3">
						{isLoading ? (
							<div className="space-y-3">
								<Skeleton className="h-16 w-full" />
								<Skeleton className="h-16 w-full" />
							</div>
						) : isError ? (
							<div className="flex flex-col items-center gap-2 py-8 text-center">
								<AlertCircleIcon className="h-10 w-10 text-destructive/50" />
								<p className="text-sm text-destructive">Failed to load shoots</p>
								<Button variant="outline" size="sm" onClick={() => refetch()}>
									Try again
								</Button>
							</div>
						) : shootsList.length === 0 ? (
							<div className="flex flex-col items-center gap-2 py-8 text-center">
								<CameraIcon className="h-10 w-10 text-muted-foreground/50" />
								<p className="text-sm text-muted-foreground">
									No shoots scheduled
								</p>
								<Button
									variant="outline"
									size="sm"
									onClick={() => openCreate()}
									aria-label="Add shoot"
								>
									<PlusIcon className="h-4 w-4 mr-2" />
									Add Shoot
								</Button>
							</div>
						) : (
							<div className="space-y-3">
								{shootsList.map((shoot) => {
									const shootDate = shoot.shootDate
										? format(new Date(shoot.shootDate), "MMM d, yyyy")
										: "No date";

									const timeRange =
										shoot.startTime && shoot.endTime
											? `${format(new Date(`2000-01-01T${shoot.startTime}`), "h:mm a")} - ${format(new Date(`2000-01-01T${shoot.endTime}`), "h:mm a")}`
											: null;

									return (
										<div
											key={shoot.id}
											className="flex items-center justify-between rounded-lg border bg-background p-4 hover:bg-muted/50 transition-colors"
										>
											<div className="flex-1 space-y-1">
												<div className="flex items-center gap-2">
													<h4 className="font-medium">
														{shoot.shootType || shoot.name || "Unnamed Shoot"}
													</h4>
													<Badge variant="outline" className="capitalize">
														{shoot.status}
													</Badge>
												</div>

												<div className="flex items-center gap-4 text-sm text-muted-foreground">
													<div className="flex items-center gap-1">
														<CameraIcon className="h-3.5 w-3.5" />
														<span>{shootDate}</span>
													</div>

													{timeRange && (
														<div className="flex items-center gap-1">
															<ClockIcon className="h-3.5 w-3.5" />
															<span>{timeRange}</span>
														</div>
													)}

													{shoot.venue && (
														<div className="flex items-center gap-1">
															<MapPinIcon className="h-3.5 w-3.5" />
															<span>{shoot.venue}</span>
														</div>
													)}
												</div>
											</div>

											<Button
												variant="ghost"
												size="sm"
												onClick={() => openEdit(shoot.id)}
												aria-label={`Edit ${shoot.shootType || shoot.name || 'shoot'}`}
											>
												<PencilIcon className="h-4 w-4" />
												<span className="sr-only">Edit shoot</span>
											</Button>
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

// ============================================================================
// Deliverables Section Component
// ============================================================================

interface DeliverablesSectionProps {
	bookingId: string;
}

function DeliverablesSection({ bookingId }: DeliverablesSectionProps) {
	const { openCreate, openEdit } = useDeliverableParams();

	const { data: deliverables, isLoading, isError, refetch } = useQuery({
		...deliverablesApi.listOptions({ bookingId, limit: 50 }),
		enabled: !!bookingId,
	});

	const items = deliverables?.data ?? [];
	const count = items.length;

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
								Deliverables
								<Badge variant="secondary" className="text-xs ml-1">
									{count}
								</Badge>
							</span>
							<span className="text-xs text-muted-foreground">
								{isLoading
									? "Loading..."
									: count === 0
										? "No deliverables added"
										: `${count} deliverable${count !== 1 ? "s" : ""}`}
							</span>
						</div>
					</AccordionTrigger>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 ml-auto"
						onClick={() => openCreate()}
						aria-label="Add deliverable"
					>
						<PlusIcon className="h-3 w-3 mr-1" />
						Add
					</Button>
				</div>
				<AccordionContent className="pb-4 pt-0">
					<div className="pl-10 pr-4 pt-3">
						{isLoading ? (
							<div className="space-y-4">
								{[...Array(3)].map((_, i) => (
									<Skeleton key={i} className="h-24 w-full" />
								))}
							</div>
						) : isError ? (
							<div className="flex flex-col items-center gap-2 py-8 text-center">
								<AlertCircleIcon className="h-10 w-10 text-destructive/50" />
								<p className="text-sm text-destructive">Failed to load deliverables</p>
								<Button variant="outline" size="sm" onClick={() => refetch()}>
									Try again
								</Button>
							</div>
						) : items.length === 0 ? (
							<div className="flex flex-col items-center gap-2 py-8 text-center">
								<PackageIcon className="h-10 w-10 text-muted-foreground/50" />
								<p className="text-sm text-muted-foreground">
									No deliverables added
								</p>
								<Button
									variant="outline"
									size="sm"
									onClick={() => openCreate()}
									aria-label="Add deliverable"
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
										className="flex items-start justify-between gap-4 p-4 border rounded-lg bg-background hover:bg-muted/50 transition-colors"
									>
										<div className="flex-1 space-y-2">
											<div className="flex items-start gap-2">
												<h4 className="font-medium">{deliverable.name}</h4>
											</div>

											<div className="flex items-center gap-2 flex-wrap">
												{deliverable.deliverableType && (
													<Badge variant="outline" className="text-xs">
														{deliverable.deliverableType}
													</Badge>
												)}

												<Badge
													variant={getStatusVariant(deliverable.status)}
													className="text-xs"
												>
													{deliverable.status}
												</Badge>

												{deliverable.priority && (
													<Badge
														variant={getPriorityVariant(deliverable.priority)}
														className="text-xs"
													>
														{deliverable.priority}
													</Badge>
												)}

												{deliverable.dueDate && (
													<div className="flex items-center gap-1 text-xs text-muted-foreground">
														<CalendarIcon className="h-3 w-3" />
														<span>
															Due: {format(new Date(deliverable.dueDate), "MMM d, yyyy")}
														</span>
													</div>
												)}
											</div>

											{deliverable.description && (
												<p className="text-sm text-muted-foreground line-clamp-2">
													{deliverable.description}
												</p>
											)}
										</div>

										<Button
											variant="ghost"
											size="icon"
											onClick={() => openEdit(deliverable.id)}
											aria-label={`Edit ${deliverable.name}`}
										>
											<PencilIcon className="h-4 w-4" />
										</Button>
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
// Payments Section Component
// ============================================================================

interface PaymentsSectionProps {
	bookingId: string;
	packageCost: string;
	totalReceived: string;
	balance: string;
}

type PaymentMethod =
	| "cash"
	| "upi"
	| "bank_transfer"
	| "cheque"
	| "card"
	| "other";

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

function PaymentsSection({
	bookingId,
	packageCost,
	totalReceived,
	balance,
}: PaymentsSectionProps) {
	const { openCreate, openEdit } = usePaymentParams();

	const { data: payments, isLoading, isError, refetch } = useQuery({
		...studioPaymentsApi.listReceivedOptions({ bookingId, limit: 50 }),
		enabled: !!bookingId,
	});

	const paymentsList = payments?.data ?? [];
	const count = paymentsList.length;

	// Calculate progress percentage
	const packageCostNum = Number.parseFloat(packageCost);
	const totalReceivedNum = Number.parseFloat(totalReceived);
	const progressPercentage =
		packageCostNum > 0 ? (totalReceivedNum / packageCostNum) * 100 : 0;

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
								Payments
								<Badge variant="secondary" className="text-xs ml-1">
									{count}
								</Badge>
							</span>
							<span className="text-xs text-muted-foreground">
								{isLoading
									? "Loading..."
									: `${progressPercentage.toFixed(0)}% paid`}
							</span>
						</div>
					</AccordionTrigger>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 ml-auto"
						onClick={() => openCreate()}
						aria-label="Add payment"
					>
						<PlusIcon className="h-3 w-3 mr-1" />
						Add
					</Button>
				</div>
				<AccordionContent className="pb-4 pt-0">
					<div className="pl-10 pr-4 pt-3 space-y-6">
						{/* Progress Bar */}
						<div className="space-y-2">
							<Progress value={progressPercentage} className="h-2" />
							<div className="flex items-center justify-between text-sm">
								<p className="text-muted-foreground">
									{formatCurrency(totalReceived)} of {formatCurrency(packageCost)}{" "}
									received ({progressPercentage.toFixed(1)}%)
								</p>
							</div>
							<div className="text-sm">
								<span className="text-muted-foreground">Balance: </span>
								<span
									className={
										Number.parseFloat(balance) > 0
											? "text-destructive font-medium"
											: "text-green-600 font-medium"
									}
								>
									{formatCurrency(balance)}
								</span>
							</div>
						</div>

						{/* Payments List */}
						{isLoading ? (
							<div className="space-y-3">
								{Array.from({ length: 3 }).map((_, i) => (
									<div
										key={i}
										className="flex items-center justify-between border rounded-lg p-4"
									>
										<div className="space-y-2 flex-1">
											<Skeleton className="h-5 w-32" />
											<Skeleton className="h-4 w-48" />
										</div>
										<Skeleton className="h-9 w-9" />
									</div>
								))}
							</div>
						) : isError ? (
							<div className="flex flex-col items-center gap-2 py-8 text-center">
								<AlertCircleIcon className="h-10 w-10 text-destructive/50" />
								<p className="text-sm text-destructive">Failed to load payments</p>
								<Button variant="outline" size="sm" onClick={() => refetch()}>
									Try again
								</Button>
							</div>
						) : paymentsList.length === 0 ? (
							<div className="flex flex-col items-center gap-2 py-8 text-center">
								<WalletIcon className="h-10 w-10 text-muted-foreground/50" />
								<p className="text-sm text-muted-foreground">
									No payments recorded
								</p>
								<Button
									variant="outline"
									size="sm"
									onClick={() => openCreate()}
									aria-label="Add payment"
								>
									<PlusIcon className="h-4 w-4 mr-2" />
									Add Payment
								</Button>
							</div>
						) : (
							<div className="space-y-3">
								{paymentsList.map((payment) => (
									<div
										key={payment.id}
										className="flex items-start justify-between border rounded-lg p-4 bg-background hover:bg-muted/50 transition-colors"
									>
										<div className="flex-1 space-y-2">
											<div className="flex items-center gap-3">
												<span className="text-lg font-semibold">
													{formatCurrency(payment.amount)}
												</span>
												<Badge
													variant={
														paymentMethodColors[
															payment.paymentMethod as PaymentMethod
														]
													}
												>
													{
														paymentMethodLabels[
															payment.paymentMethod as PaymentMethod
														]
													}
												</Badge>
											</div>
											<div className="text-sm text-muted-foreground space-y-1">
												<p>
													Received:{" "}
													{format(new Date(payment.receivedDate), "MMM dd, yyyy")}
												</p>
												{payment.transactionReference && (
													<p>Reference: {payment.transactionReference}</p>
												)}
												{payment.notes && (
													<p className="text-xs mt-1">{payment.notes}</p>
												)}
											</div>
										</div>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => openEdit(payment.id)}
											aria-label="Edit payment"
										>
											<PencilIcon className="h-4 w-4" />
										</Button>
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

export function BookingDetailPageClient({
	organizationSlug,
	bookingId,
}: BookingDetailPageClientProps) {
	const { data: booking, isLoading, isError, refetch } = useQuery({
		...bookingsApi.getOptions(bookingId),
		enabled: !!bookingId,
	});

	const bookingData = booking?.data;
	const status = bookingData?.status || "new";
	const statusStyle = statusColors[status] || statusColors.new;

	const backHref = `/app/${organizationSlug}/bookings`;

	// TODO: Implement edit functionality - could open a sheet or navigate to edit page
	const handleOverviewEdit = () => {
		// Placeholder for edit action
		console.log("Edit overview");
	};

	return (
		<PageContent
			title={
				isLoading ? (
					<Skeleton className="h-6 w-48" />
				) : (
					<div className="flex items-center gap-3">
						<span>{bookingData?.name}</span>
						<Badge
							variant="outline"
							className={cn("capitalize", statusStyle.bg, statusStyle.text)}
						>
							{status}
						</Badge>
					</div>
				)
			}
			backHref={backHref}
		>
			<div className="space-y-6 pb-8">
				{/* Hero Card */}
				<HeroCard
					packageCost={bookingData?.packageCost ?? "0"}
					totalReceived={bookingData?.totalReceived ?? "0"}
					balance={bookingData?.balance ?? "0"}
					isLoading={isLoading}
				/>

				{/* Accordion Sections */}
				{isLoading ? (
					<div className="space-y-4">
						{[1, 2, 3, 4].map((i) => (
							<Skeleton key={i} className="h-20 w-full rounded-lg" />
						))}
					</div>
				) : isError ? (
					<div className="flex flex-col items-center gap-2 py-8 text-center">
						<AlertCircleIcon className="h-10 w-10 text-destructive/50" />
						<p className="text-sm text-destructive">Failed to load booking</p>
						<Button variant="outline" size="sm" onClick={() => refetch()}>
							Try again
						</Button>
					</div>
				) : (
					<Accordion
						type="multiple"
						defaultValue={["overview", "shoots", "deliverables", "payments"]}
						className="space-y-3"
					>
						{bookingData && (
							<OverviewSection
								booking={{
									bookingType: bookingData.bookingType,
									packageType: bookingData.packageType,
									note: bookingData.note,
									createdAt: bookingData.createdAt,
									participants: bookingData.participants ?? [],
									events: bookingData.events ?? [],
								}}
								onEdit={handleOverviewEdit}
							/>
						)}

						<ShootsSection bookingId={bookingId} />

						<DeliverablesSection bookingId={bookingId} />

						{bookingData && (
							<PaymentsSection
								bookingId={bookingId}
								packageCost={bookingData.packageCost}
								totalReceived={bookingData.totalReceived}
								balance={bookingData.balance}
							/>
						)}
					</Accordion>
				)}
			</div>
		</PageContent>
	);
}
