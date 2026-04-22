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
import { format } from "date-fns";
import {
	CalendarIcon,
	MailIcon,
	MapPinIcon,
	PhoneIcon,
	UserIcon,
} from "lucide-react";
import { memo } from "react";

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
			eventDate: Date | string;
			venue: string | null;
		}>;
	};
}

// ============================================================================
// Main Component
// ============================================================================

export const OverviewTab = memo(function OverviewTab({
	booking,
}: OverviewTabProps) {
	return (
		<div className="space-y-6">
			{/* Financial Summary Card */}
			<Card>
				<CardContent className="pt-6">
					<div className="grid grid-cols-3 gap-4">
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">
								Package Cost
							</p>
							<p className="text-2xl font-bold">
								{formatMoney(booking.packageCost)}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">
								Total Received
							</p>
							<p className="text-2xl font-bold text-green-600">
								{formatMoney(booking.totalReceived)}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">
								Balance
							</p>
							<p className="text-2xl font-bold text-amber-600">
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
									<div className="flex items-center gap-2">
										<p className="font-medium">
											{participant.client.name}
										</p>
										<Badge
											variant="secondary"
											className="text-xs"
										>
											{participant.role}
										</Badge>
									</div>
									<div className="space-y-0.5 text-sm text-muted-foreground">
										{participant.client.email && (
											<div className="flex items-center gap-1.5">
												<MailIcon className="h-3.5 w-3.5" />
												<span>
													{participant.client.email}
												</span>
											</div>
										)}
										{participant.client.phoneNumber && (
											<div className="flex items-center gap-1.5">
												<PhoneIcon className="h-3.5 w-3.5" />
												<span>
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
									className="flex items-start justify-between gap-4"
								>
									<div className="space-y-1">
										<p className="font-medium">
											{event.eventType}
										</p>
										{event.venue && (
											<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
												<MapPinIcon className="h-3.5 w-3.5" />
												<span>{event.venue}</span>
											</div>
										)}
									</div>
									<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
										<CalendarIcon className="h-3.5 w-3.5" />
										<span>
											{formatDate(event.eventDate)}
										</span>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Booking Details Grid */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Booking Details</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">
								Booking Type
							</p>
							<p className="font-medium">
								{booking.bookingType || "—"}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-sm text-muted-foreground">
								Package Type
							</p>
							<p className="font-medium">
								{booking.packageType || "—"}
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
							<Badge variant="outline">{booking.phase}</Badge>
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
						<p className="text-sm text-muted-foreground">
							{booking.note}
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
});
