"use client";

import { Button } from "@repo/ui/components/button";
import {
	BookingForm,
	type BookingFormValues,
	defaultBookingValues,
} from "@saas/studio/components/bookings";
import { bookingsMutations, studioQueryKeys } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, use } from "react";
import { toast } from "sonner";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export default function NewBookingPage({ params }: Props) {
	const router = useRouter();
	const queryClient = useQueryClient();

	// We need to await params in Next.js 15+
	const { organizationSlug } = use(params);

	const createMutation = useMutation({
		...bookingsMutations.create(),
		onSuccess: (data) => {
			toast.success("Booking created successfully", {
				action: {
					label: "View",
					onClick: () =>
						router.push(
							`/app/${organizationSlug}/bookings/${data.data.id}`,
						),
				},
			});
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.bookings.all,
			});
			router.push(`/app/${organizationSlug}/bookings`);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create booking");
		},
	});

	const handleSubmit = (data: BookingFormValues) => {
		createMutation.mutate({
			name: data.name,
			bookingType: data.bookingType,
			packageType: data.packageType,
			packageCost: data.packageCost,
			note: data.note,
			participants: data.participants,
			events: data.events,
		});
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="icon" asChild>
					<Link href={`/app/${organizationSlug}/bookings`}>
						<ArrowLeftIcon className="h-4 w-4" />
					</Link>
				</Button>
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">
						New Booking
					</h1>
					<p className="text-muted-foreground">
						Create a new booking for your studio
					</p>
				</div>
			</div>

			{/* Form - Wrapped in Suspense for nuqs/useSearchParams compatibility */}
			<Suspense fallback={<div className="animate-pulse h-96 bg-muted rounded-lg" />}>
				<BookingForm
					defaultValues={defaultBookingValues}
					onSubmit={handleSubmit}
					isPending={createMutation.isPending}
					mode="create"
				/>
			</Suspense>
		</div>
	);
}
