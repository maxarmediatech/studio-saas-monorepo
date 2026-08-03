"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { formatMoney } from "@saas/shared/lib";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	CalendarIcon,
	MailIcon,
	MapPinIcon,
	PhoneIcon,
	UserIcon,
} from "lucide-react";
import { memo, useMemo } from "react";

// ============================================================================
// Utilities
// ============================================================================

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

const formatDate = (dateValue: Date | string) => {
	return format(new Date(dateValue), "MMM d, yyyy");
};

const humanizeKey = (value: string | null | undefined, fallback = "—") => {
	if (!value) {
		return fallback;
	}

	return value
		.split("_")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
};

// ============================================================================
// Types
// ============================================================================

interface OverviewTabProps {
	booking: {
		name: string;
		referenceNumber: string;
		bookingType: string | null;
		packageType: string | null;
		packageCost: string;
		totalReceived: string;
		balance: string;
		phase: string;
		note: string | null;
		bookingDate: Date | string;
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
			eventDate: Date | string | null;
			side: "common" | "bride" | "groom" | "both" | "separateCommon";
			guestCount: string | null;
			isTentative: boolean;
			dateWindow: string | null;
			coverageNotes: string | null;
			venue: string | null;
		}>;
		sourceQuotationCommitments: {
			deliveryTimelines: string[];
			fixedTerms: string[];
		} | null;
	};
}

// ============================================================================
// Main Component
// ============================================================================

export const OverviewTab = memo(function OverviewTab({
	booking,
}: OverviewTabProps) {
	const { data: bookingTypesData } = useQuery(
		configurationsApi.bookingTypesOptions(),
	);
	const { data: packageTypesData } = useQuery(
		configurationsApi.packageTypesOptions(),
	);
	const { data: relationTypesData } = useQuery(
		configurationsApi.relationTypesOptions(),
	);
	const { data: eventTypesData } = useQuery(
		configurationsApi.eventTypesOptions(),
	);

	const bookingTypeLabels = useMemo(() => {
		const map = new Map<string, string>();
		for (const config of bookingTypesData?.data ?? []) {
			map.set(config.key, config.label);
		}
		return map;
	}, [bookingTypesData]);

	const packageTypeLabels = useMemo(() => {
		const map = new Map<string, string>();
		for (const config of packageTypesData?.data ?? []) {
			map.set(config.key, config.label);
		}
		return map;
	}, [packageTypesData]);

	const relationTypeLabels = useMemo(() => {
		const map = new Map<string, string>();
		for (const config of relationTypesData?.data ?? []) {
			map.set(config.key, config.label);
		}
		return map;
	}, [relationTypesData]);

	const eventTypeLabels = useMemo(() => {
		const map = new Map<string, string>();
		for (const config of eventTypesData?.data ?? []) {
			map.set(config.key, config.label);
		}
		return map;
	}, [eventTypesData]);

	const bookingTypeLabel = booking.bookingType
		? (bookingTypeLabels.get(booking.bookingType) ?? "—")
		: "—";

	const packageTypeLabel = booking.packageType
		? (packageTypeLabels.get(booking.packageType) ?? "—")
		: "—";

	return (
		<div className="space-y-6">
			{/* Financial Summary Card */}
			<Card>
				<CardContent className="pt-6">
					<div className="grid gap-4 sm:grid-cols-3">
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">
								Package Cost
							</p>
							<p className="text-2xl font-bold break-words [overflow-wrap:anywhere]">
								{formatMoney(booking.packageCost)}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">
								Total Received
							</p>
							<p className="text-2xl font-bold text-green-600 break-words [overflow-wrap:anywhere]">
								{formatMoney(booking.totalReceived)}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">
								Balance
							</p>
							<p className="text-2xl font-bold text-amber-600 break-words [overflow-wrap:anywhere]">
								{formatMoney(booking.balance)}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Clients/Participants Section */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<UserIcon className="h-4 w-4" />
						Clients
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{booking.participants.map((participant) => (
							<div
								key={participant.client.id}
								className="flex items-start gap-3"
							>
								<Avatar className="h-10 w-10">
									<AvatarFallback>
										{getInitials(participant.client.name)}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 space-y-1">
									<div className="flex flex-wrap items-center gap-2">
										<p className="font-medium break-words [overflow-wrap:anywhere]">
											{participant.client.name}
										</p>
										<Badge
											variant="secondary"
											className="text-xs"
										>
											{relationTypeLabels.get(
												participant.role,
											) ?? humanizeKey(participant.role)}
										</Badge>
									</div>
									<div className="space-y-0.5 text-sm text-muted-foreground">
										{participant.client.email && (
											<div className="flex items-center gap-1.5">
												<MailIcon className="h-3.5 w-3.5" />
												<span className="break-words [overflow-wrap:anywhere]">
													{participant.client.email}
												</span>
											</div>
										)}
										{participant.client.phoneNumber && (
											<div className="flex items-center gap-1.5">
												<PhoneIcon className="h-3.5 w-3.5" />
												<span className="break-words [overflow-wrap:anywhere]">
													{
														participant.client
															.phoneNumber
													}
												</span>
											</div>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Events Section */}
			{booking.events.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base flex items-center gap-2">
							<CalendarIcon className="h-4 w-4" />
							Events
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{booking.events.map((event) => (
								<div
									key={`${event.eventType}-${event.eventDate}`}
									className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
								>
									<div className="space-y-1">
										<p className="font-medium break-words [overflow-wrap:anywhere]">
											{eventTypeLabels.get(
												event.eventType,
											) ?? humanizeKey(event.eventType)}
										</p>
										{event.venue && (
											<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
												<MapPinIcon className="h-3.5 w-3.5" />
												<span className="break-words [overflow-wrap:anywhere]">
													{event.venue}
												</span>
											</div>
										)}
									</div>
									<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
										<CalendarIcon className="h-3.5 w-3.5" />
										<span>
											{event.eventDate
												? formatDate(event.eventDate)
												: (event.dateWindow ??
													"Date not scheduled")}
										</span>
									</div>
									<p className="text-xs capitalize text-muted-foreground">
										{humanizeKey(event.side)}
										{event.guestCount
											? ` · ${event.guestCount} guests`
											: ""}
									</p>
									{event.coverageNotes ? (
										<p className="whitespace-pre-wrap text-sm text-muted-foreground">
											{event.coverageNotes}
										</p>
									) : null}
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{booking.sourceQuotationCommitments ? (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">
							Quotation commitments
						</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-5 md:grid-cols-2">
						<div>
							<p className="mb-2 text-sm font-medium">
								Delivery timelines
							</p>
							<ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
								{booking.sourceQuotationCommitments.deliveryTimelines.map(
									(item) => (
										<li key={item}>{item}</li>
									),
								)}
							</ul>
						</div>
						<div>
							<p className="mb-2 text-sm font-medium">
								Fixed terms
							</p>
							<ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
								{booking.sourceQuotationCommitments.fixedTerms.map(
									(item) => (
										<li key={item}>{item}</li>
									),
								)}
							</ul>
						</div>
					</CardContent>
				</Card>
			) : null}

			{/* Booking Details Grid */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Booking Details</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">
								Booking Type
							</p>
							<p className="font-medium break-words [overflow-wrap:anywhere]">
								{bookingTypeLabel}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">
								Package Type
							</p>
							<p className="font-medium break-words [overflow-wrap:anywhere]">
								{packageTypeLabel}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">
								Booking Date
							</p>
							<p className="font-medium">
								{formatDate(booking.bookingDate)}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">
								Status
							</p>
							<Badge variant="outline">
								{humanizeKey(booking.phase)}
							</Badge>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Notes Section */}
			{booking.note && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Notes</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">
							{booking.note}
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
});
