"use client";

import { useRouter } from "next/navigation";
import { Form } from "@repo/ui/components/form";
import { Button } from "@repo/ui/components/button";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { useBookingForm } from "./use-booking-form";
import { BookingDetailsStep } from "./BookingDetailsStep";
import { BookingEventsStep } from "./BookingEventsStep";
import { TAB_LABELS, type BookingFormValues } from "./booking-form-schema";

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
		handleSubmit,
		TABS,
	} = useBookingForm({ defaultValues, onSubmit, mode });

	return (
		<Form {...form}>
			<form onSubmit={handleSubmit} className="space-y-6">
				{/* Error Summary */}
				{showErrorSummary && (
					<Alert variant="destructive">
						<AlertCircleIcon className="h-4 w-4" />
						<AlertTitle>Validation Errors</AlertTitle>
						<AlertDescription>
							Please fix the errors on the indicated tabs before submitting.
							<ul className="mt-2 list-disc pl-5">
								{errorTabs.map((tab) => (
									<li key={tab}>
										<button
											type="button"
											className="text-primary underline capitalize"
											onClick={() => handleTabChange(tab)}
										>
											{TAB_LABELS[tab]} Tab
										</button>
									</li>
								))}
							</ul>
						</AlertDescription>
					</Alert>
				)}

				{/* Tabs */}
				<Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
					<TabsList className="grid w-full grid-cols-2">
						{TABS.map((tab) => (
							<TabsTrigger
								key={tab}
								value={tab}
								className="capitalize data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
							>
								{TAB_LABELS[tab]}
							</TabsTrigger>
						))}
					</TabsList>

					<TabsContent value="details" className="space-y-4">
						<BookingDetailsStep />
					</TabsContent>

					<TabsContent value="events" className="space-y-4">
						<BookingEventsStep />
					</TabsContent>
				</Tabs>

				{/* Navigation Buttons */}
				<div className="flex items-center justify-between pt-6 border-t">
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={goToPreviousTab}
							disabled={isFirstTab}
						>
							Previous
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={goToNextTab}
							disabled={isLastTab}
						>
							Next
						</Button>
					</div>

					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="secondary"
							onClick={() => router.back()}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
							{mode === "create" ? "Create Booking" : "Save Changes"}
						</Button>
					</div>
				</div>
			</form>
		</Form>
	);
}
