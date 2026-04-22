"use client";

import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import { format, parseISO } from "date-fns";
import { ArrowRightIcon, CalendarPlusIcon } from "lucide-react";
import Link from "next/link";

interface RecentBooking {
	id: string;
	name: string;
	referenceNumber: string;
	status: string;
	packageCost: string;
	totalReceived: string;
	bookingDate: string;
	createdAt: string;
}

interface RecentBookingsProps {
	bookings: RecentBooking[];
	organizationSlug: string;
}

const statusColors: Record<string, string> = {
	new: "bg-blue-100 text-blue-700",
	preparation: "bg-amber-100 text-amber-700",
	shooting: "bg-purple-100 text-purple-700",
	delivery: "bg-indigo-100 text-indigo-700",
	completed: "bg-green-100 text-green-700",
	cancelled: "bg-gray-100 text-gray-700",
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	maximumFractionDigits: 0,
});

function formatCurrency(value: string): string {
	const num = Number.parseFloat(value);
	return currencyFormatter.format(num);
}

function formatBookingDate(value: string): string {
	return format(parseISO(value), "MMM d, yyyy");
}

export function RecentBookings({
	bookings,
	organizationSlug,
}: RecentBookingsProps) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base font-semibold flex items-center gap-2">
						<CalendarPlusIcon className="size-4 text-blue-500" />
						Recent Bookings
					</CardTitle>
					<Link
						href={`/app/${organizationSlug}/bookings`}
						className="text-sm font-medium text-primary hover:underline"
					>
						View all
					</Link>
				</div>
			</CardHeader>
			<CardContent className="pb-4">
				{bookings.length === 0 ? (
					<div className="text-center py-8">
						<CalendarPlusIcon className="size-8 text-muted-foreground mx-auto mb-2" />
						<p className="text-sm text-muted-foreground">
							No bookings yet
						</p>
						<Link
							href={`/app/${organizationSlug}/bookings/new`}
							className="text-sm font-medium text-primary hover:underline mt-1 inline-block"
						>
							Create your first booking
						</Link>
					</div>
				) : (
					<div className="space-y-2">
						{bookings.map((booking) => (
							<Link
								key={booking.id}
								href={`/app/${organizationSlug}/bookings/${booking.id}`}
								className="flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-muted/50"
							>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="text-sm font-medium truncate">
											{booking.name}
										</p>
										<Badge
											variant="secondary"
											className={cn(
												"text-xs capitalize",
												statusColors[booking.status],
											)}
										>
											{booking.status}
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground">
										{booking.referenceNumber} &middot;{" "}
										Booked{" "}
										{formatBookingDate(booking.bookingDate)}
									</p>
								</div>
								<div className="flex items-center gap-2 flex-shrink-0">
									<span className="text-sm font-medium">
										{formatCurrency(booking.packageCost)}
									</span>
									<ArrowRightIcon className="size-4 text-muted-foreground" />
								</div>
							</Link>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
