"use client";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Form } from "@repo/ui/components/form";
import { AlertCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { BookingDeliverablesStep } from "./BookingDeliverablesStep";
import { BookingDetailsStep } from "./BookingDetailsStep";
import { BookingPaymentsStep } from "./BookingPaymentsStep";
import { BookingShootsStep } from "./BookingShootsStep";
import { BookingReviewStep } from "./BookingReviewStep";
import { BookingFormLayout } from "./BookingFormLayout";
import { BookingStepperSidebar } from "./BookingStepperSidebar";
import { BookingMobileStepper } from "./BookingMobileStepper";
import { BookingFormNavigation } from "./BookingFormNavigation";
import { type BookingFormValues, TAB_LABELS } from "./booking-form-schema";
import { useBookingForm } from "./use-booking-form";

interface BookingFormProps {
	defaultValues?: BookingFormValues;
	onSubmit: (data: BookingFormValues) => void;
	isPending?: boolean;
	mode?: "create" | "edit";
}

export function BookingForm({
	defaultValues,
	onSubmit,
	isPending = false,
	mode = "create",
}: BookingFormProps) {
	const router = useRouter();

	const {
		form,
		activeTab,
		handleTabChange,
		goToNextTab,
		goToPreviousTab,
		isFirstTab,
		isLastTab,
		errorTabs,
		showErrorSummary,
		tabsWithErrors,
		completedSteps,
		handleSubmit,
	} = useBookingForm({ defaultValues, onSubmit, mode });

	// Render the current step content
	const renderStepContent = () => {
		switch (activeTab) {
			case "details":
				return <BookingDetailsStep />;
			case "shoots":
				return <BookingShootsStep />;
			case "payments":
				return <BookingPaymentsStep />;
			case "deliverables":
				return <BookingDeliverablesStep />;
			case "review":
				return <BookingReviewStep onNavigateToStep={handleTabChange} />;
			default:
				return null;
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={handleSubmit}>
				<BookingFormLayout
					stepper={
						<BookingStepperSidebar
							activeStep={activeTab}
							completedSteps={completedSteps}
							stepsWithErrors={tabsWithErrors}
							onStepClick={handleTabChange}
						/>
					}
					mobileStepper={
						<BookingMobileStepper
							activeStep={activeTab}
							completedSteps={completedSteps}
							stepsWithErrors={tabsWithErrors}
							onStepClick={handleTabChange}
						/>
					}
					footer={
						<BookingFormNavigation
							onPrevious={goToPreviousTab}
							onNext={goToNextTab}
							onCancel={() => router.back()}
							isFirstStep={isFirstTab}
							isLastStep={isLastTab}
							isPending={isPending}
							mode={mode}
						/>
					}
				>
					{/* Error Summary */}
					{showErrorSummary && (
						<Alert variant="destructive" className="mb-6">
							<AlertCircleIcon className="h-4 w-4" />
							<AlertTitle>Validation Errors</AlertTitle>
							<AlertDescription>
								Please fix the errors on the indicated steps before
								submitting.
								<ul className="mt-2 list-disc pl-5">
									{errorTabs.map((tab) => (
										<li key={tab}>
											<button
												type="button"
												className="text-primary underline capitalize"
												onClick={() => handleTabChange(tab)}
											>
												{TAB_LABELS[tab]} Step
											</button>
										</li>
									))}
								</ul>
							</AlertDescription>
						</Alert>
					)}

					{/* Current Step Content */}
					{renderStepContent()}
				</BookingFormLayout>
			</form>
		</Form>
	);
}
