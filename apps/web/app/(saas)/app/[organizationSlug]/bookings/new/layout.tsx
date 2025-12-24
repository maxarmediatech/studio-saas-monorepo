"use client";

import { Button } from "@repo/ui/components/button";
import {
	BookingFormLayout,
	BookingFormNavigation,
	BookingMobileStepper,
	BookingStepperSidebar,
	BOOKING_TABS,
	type BookingTab,
} from "@saas/studio/components/bookings";
import {
	useBookingFormHydrated,
	useBookingFormStore,
} from "@saas/studio/components/bookings/booking-form/store/use-booking-form-store";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMemo, type PropsWithChildren } from "react";

export default function NewBookingLayout({ children }: PropsWithChildren) {
	const router = useRouter();
	const pathname = usePathname();
	const params = useParams<{ organizationSlug: string }>();
	const organizationSlug = params.organizationSlug;

	const { completedSteps } = useBookingFormStore();
	const hasHydrated = useBookingFormHydrated();

	// Extract current step from URL path
	const pathSegments = pathname.split("/");
	const currentStep = pathSegments[pathSegments.length - 1] as BookingTab;
	const currentIndex = BOOKING_TABS.indexOf(currentStep);

	// Determine if we're on a valid step
	const isValidStep = BOOKING_TABS.includes(currentStep);
	const isFirstStep = currentIndex === 0;
	const isLastStep = currentIndex === BOOKING_TABS.length - 1;

	// Memoize Set creation to prevent unnecessary re-renders
	const completedStepsSet = useMemo(
		() => new Set<BookingTab>(completedSteps),
		[completedSteps],
	);

	// Memoize static error object
	const stepsWithErrors = useMemo<Record<BookingTab, boolean>>(
		() => ({
			details: false,
			shoots: false,
			payments: false,
			deliverables: false,
			review: false,
		}),
		[],
	);

	// Navigation handlers
	const handleStepClick = (step: BookingTab) => {
		router.push(`/app/${organizationSlug}/bookings/new/${step}`);
	};

	const handleNext = () => {
		if (currentIndex < BOOKING_TABS.length - 1) {
			const nextStep = BOOKING_TABS[currentIndex + 1];
			router.push(`/app/${organizationSlug}/bookings/new/${nextStep}`);
		}
	};

	const handlePrevious = () => {
		if (currentIndex > 0) {
			const prevStep = BOOKING_TABS[currentIndex - 1];
			router.push(`/app/${organizationSlug}/bookings/new/${prevStep}`);
		}
	};

	const handleCancel = () => {
		router.push(`/app/${organizationSlug}/bookings`);
	};

	// Free navigation - all steps accessible
	const canNavigateToStep = () => true;

	// Show loading state until hydrated to prevent hydration mismatch
	if (!hasHydrated) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	// If not a valid step, just render children (will be handled by the page)
	if (!isValidStep) {
		return <>{children}</>;
	}

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

			{/* Form Layout */}
			<BookingFormLayout
				stepper={
					<BookingStepperSidebar
						activeStep={currentStep}
						completedSteps={completedStepsSet}
						stepsWithErrors={stepsWithErrors}
						onStepClick={handleStepClick}
						canNavigateToStep={canNavigateToStep}
						isNavigating={false}
					/>
				}
				mobileStepper={
					<BookingMobileStepper
						activeStep={currentStep}
						completedSteps={completedStepsSet}
						stepsWithErrors={stepsWithErrors}
						onStepClick={handleStepClick}
						canNavigateToStep={canNavigateToStep}
						isNavigating={false}
					/>
				}
				footer={
					<BookingFormNavigation
						onPrevious={handlePrevious}
						onNext={handleNext}
						onCancel={handleCancel}
						isFirstStep={isFirstStep}
						isLastStep={isLastStep}
						isPending={false}
						isNavigating={false}
						mode="create"
					/>
				}
			>
				{children}
			</BookingFormLayout>
		</div>
	);
}
