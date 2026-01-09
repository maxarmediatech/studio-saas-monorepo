"use client";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { bookingsApi, bookingsMutations } from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";

import {
	BookingDetailContent,
	BookingDetailHeader,
	BookingHeader,
	BookingDetailLayout,
	BookingNoteCard,
	ClientCard,
	ContactInfoCard,
	EventVenueCard,
	QuickStatsCard,
} from "./components";

// ============================================================================
// Types
// ============================================================================

interface BookingDetailPageClientProps {
	organizationSlug: string;
	bookingId: string;
}

type BookingPhase =
	| "new"
	| "preparation"
	| "shooting"
	| "delivery"
	| "completed"
	| "cancelled";

// ============================================================================
// Main Component
// ============================================================================

export function BookingDetailPageClient({
	organizationSlug,
	bookingId,
}: BookingDetailPageClientProps) {
	const queryClient = useQueryClient();

	// Fetch booking data
	const {
		data: booking,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...bookingsApi.getOptions(bookingId),
		enabled: !!bookingId,
	});

	// Update status mutation
	const updateStatusMutation = useMutation({
		...bookingsMutations.updateStatus(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: bookingsApi.getOptions(bookingId).queryKey,
			});
			toast.success("Booking status updated");
		},
		onError: (error) => {
			toast.error("Failed to update status", {
				description: error.message,
			});
		},
	});

	const bookingData = booking?.data;
	const status = (bookingData?.status || "new") as BookingPhase;
	const backHref = `/app/${organizationSlug}/bookings`;

	// Get primary client for contact info
	const primaryParticipant = bookingData?.participants?.[0];
	const primaryClient = primaryParticipant?.client;

	// Handlers
	const handlePhaseChange = async (newPhase: BookingPhase) => {
		await updateStatusMutation.mutateAsync({
			id: bookingId,
			status: newPhase,
		});
	};

	const handleEditNote = () => {
		// TODO: Open note edit dialog/sheet
		console.log("Edit note");
	};

	// Loading state
	if (isLoading) {
		const backHref = `/app/${organizationSlug}/bookings`;
		return (
			<BookingDetailLayout
				header={<BookingDetailHeader backHref={backHref} />}
				sidebar={
					<div className="space-y-4">
						<Skeleton className="h-24 w-full" />
						<Skeleton className="h-32 w-full" />
						<Skeleton className="h-24 w-full" />
					</div>
				}
			>
				{/* Status Stepper skeleton */}
				<Skeleton className="h-28 w-full rounded-xl" />
				<Skeleton className="h-48 w-full" />
				<Skeleton className="h-48 w-full" />
				<Skeleton className="h-64 w-full" />
			</BookingDetailLayout>
		);
	}

	// Error state
	if (isError || !bookingData) {
		return (
			<BookingDetailLayout
				header={<BookingDetailHeader backHref={backHref} />}
				sidebar={<div />}
			>
				<div className="flex flex-col items-center gap-4 py-12 text-center">
					<AlertCircleIcon className="h-12 w-12 text-destructive/50" />
					<div>
						<p className="text-lg font-medium text-destructive">
							Failed to load booking
						</p>
						<p className="text-sm text-muted-foreground">
							The booking may have been deleted or you may not have access.
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
					onEdit={() => console.log("Edit booking")}
					onDuplicate={() => console.log("Duplicate booking")}
					onDelete={() => console.log("Delete booking")}
				/>
			}
			sidebar={
				<>
					{/* Booking Note - prominent position */}
					<BookingNoteCard
						note={bookingData.note}
						onEdit={handleEditNote}
					/>

					{/* Primary Client */}
					<ClientCard
						participants={bookingData.participants ?? []}
						organizationSlug={organizationSlug}
					/>

					{/* Event Venue */}
					<EventVenueCard events={bookingData.events ?? []} />

					{/* Contact Info */}
					{primaryClient && (
						<ContactInfoCard
							email={primaryClient.email}
							phone={primaryClient.phoneNumber}
						/>
					)}

					{/* Quick Stats */}
					<QuickStatsCard
						createdAt={bookingData.createdAt}
						bookingType={bookingData.bookingType}
						packageType={bookingData.packageType}
						shootsCount={bookingData.shootsCount ?? 0}
						deliverablesCount={bookingData.deliverablesCount ?? 0}
					/>
				</>
			}
		>
			<BookingHeader
				name={bookingData.name}
				referenceNumber={bookingData.referenceNumber}
				status={status}
				createdAt={bookingData.createdAt}
				clientName={primaryClient?.name}
				isPaid={Number.parseFloat(bookingData.balance) <= 0}
			/>

			{/* Main Content: Unified card with Shoots, Deliverables, Payments */}
			<BookingDetailContent
				bookingId={bookingId}
				packageCost={bookingData.packageCost}
				totalReceived={bookingData.totalReceived}
				balance={bookingData.balance}
			/>
		</BookingDetailLayout>
	);
}
