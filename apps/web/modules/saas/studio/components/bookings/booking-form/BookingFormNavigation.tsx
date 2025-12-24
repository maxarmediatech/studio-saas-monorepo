"use client";

import { Button } from "@repo/ui/components/button";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	CheckIcon,
	Loader2Icon,
} from "lucide-react";

interface BookingFormNavigationProps {
	onPrevious: () => void;
	onNext: () => void;
	onCancel: () => void;
	isFirstStep: boolean;
	isLastStep: boolean;
	isPending: boolean;
	mode: "create" | "edit";
}

/**
 * Navigation buttons for the booking form wizard
 * Shows Previous/Next buttons and Submit on last step
 */
export function BookingFormNavigation({
	onPrevious,
	onNext,
	onCancel,
	isFirstStep,
	isLastStep,
	isPending,
	mode,
}: BookingFormNavigationProps) {
	return (
		<div className="flex items-center justify-between">
			{/* Left side: Previous button */}
			<div>
				<Button
					type="button"
					variant="outline"
					onClick={onPrevious}
					disabled={isFirstStep}
				>
					<ChevronLeftIcon className="mr-2 h-4 w-4" />
					Previous
				</Button>
			</div>

			{/* Right side: Cancel, Next/Submit */}
			<div className="flex items-center gap-3">
				<Button type="button" variant="ghost" onClick={onCancel}>
					Cancel
				</Button>

				{isLastStep ? (
					<Button type="submit" disabled={isPending}>
						{isPending ? (
							<>
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
								{mode === "create" ? "Creating..." : "Saving..."}
							</>
						) : (
							<>
								<CheckIcon className="mr-2 h-4 w-4" />
								{mode === "create" ? "Create Booking" : "Save Changes"}
							</>
						)}
					</Button>
				) : (
					<Button type="button" onClick={onNext}>
						Next
						<ChevronRightIcon className="ml-2 h-4 w-4" />
					</Button>
				)}
			</div>
		</div>
	);
}
