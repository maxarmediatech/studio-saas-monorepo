"use client";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { bookingsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";

import {
	BookingDetailHeader,
	BookingDetailLayout,
	BookingScrollSpy,
} from "./components";

interface BookingDetailPageClientProps {
	organizationSlug: string;
	bookingId: string;
}

export function BookingDetailPageClient({
	organizationSlug,
	bookingId,
}: BookingDetailPageClientProps) {
	const {
		data: booking,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...bookingsApi.getOptions(bookingId),
		enabled: !!bookingId,
	});

	const bookingData = booking?.data;
	const backHref = `/app/${organizationSlug}/bookings`;

	if (isLoading) {
		return (
			<BookingDetailLayout
				header={<BookingDetailHeader backHref={backHref} />}
			>
				<Skeleton className="h-28 w-full rounded-xl" />
				<Skeleton className="h-48 w-full" />
				<Skeleton className="h-48 w-full" />
				<Skeleton className="h-64 w-full" />
			</BookingDetailLayout>
		);
	}

	if (isError || !bookingData) {
		return (
			<BookingDetailLayout
				header={<BookingDetailHeader backHref={backHref} />}
			>
				<div className="flex flex-col items-center gap-4 py-12 text-center">
					<AlertCircleIcon className="h-12 w-12 text-destructive/50" />
					<div>
						<p className="text-lg font-medium text-destructive">
							Failed to load booking
						</p>
						<p className="text-sm text-muted-foreground">
							The booking may have been deleted or you may not
							have access.
						</p>
					</div>
					<Button variant="outline" onClick={() => refetch()}>
						Try again
					</Button>
				</div>
			</BookingDetailLayout>
		);
	}

	return (
		<BookingDetailLayout
			header={
				<BookingDetailHeader
					backHref={backHref}
					referenceNumber={bookingData.referenceNumber}
					onEdit={() => console.log("Edit booking")}
					onDuplicate={() => console.log("Duplicate booking")}
					onDelete={() => console.log("Delete booking")}
				/>
			}
			rawContent
		>
			<BookingScrollSpy
				bookingId={bookingId}
				booking={{
					name: bookingData.name,
					status: bookingData.status,
					bookingType: bookingData.bookingType,
					packageType: bookingData.packageType,
					packageCost: bookingData.packageCost,
					totalReceived: bookingData.totalReceived,
					balance: bookingData.balance,
					note: bookingData.note,
					participants: bookingData.participants,
					createdAt: bookingData.createdAt,
				}}
			/>
		</BookingDetailLayout>
	);
}
