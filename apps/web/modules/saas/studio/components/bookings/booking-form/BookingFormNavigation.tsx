"use client";

import { Button } from "@repo/ui/components/button";
import {
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	Loader2Icon,
	SkipForwardIcon,
} from "lucide-react";

interface BookingFormNavigationProps {
	onPrevious: () => void;
	onNext: () => void;
	onSkip?: () => void;
	onCancel: () => void;
	isFirstStep: boolean;
	isLastStep: boolean;
	isPending: boolean;
	isNavigating?: boolean;
	canSkip?: boolean;
	mode: "create" | "edit";
}

/**
 * Navigation buttons for the booking form wizard
 * Shows Previous/Next buttons and Submit on last step
 */
export function BookingFormNavigation({
	onPrevious,
	onNext,
	onSkip,
	onCancel,
	isFirstStep,
	isLastStep,
	isPending,
	isNavigating = false,
	canSkip = false,
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
					disabled={isFirstStep || isNavigating}
				>
					<ChevronLeftIcon className="mr-2 h-4 w-4" />
					Previous
				</Button>
			</div>

			{/* Right side: Cancel, Skip, Next/Submit */}
			<div className="flex items-center gap-3">
				<Button
					type="button"
					variant="ghost"
					onClick={onCancel}
					disabled={isNavigating}
				>
					Cancel
				</Button>

				{canSkip && onSkip && !isLastStep && (
					<Button
						type="button"
						variant="outline"
						onClick={onSkip}
						disabled={isNavigating}
					>
						<SkipForwardIcon className="mr-2 h-4 w-4" />
						Skip
					</Button>
				)}

				{isLastStep ? (
					<Button type="submit" disabled={isPending || isNavigating}>
						{isPending ? (
							<>
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
								{mode === "create"
									? "Creating..."
									: "Saving..."}
							</>
						) : (
							<>
								<CheckIcon className="mr-2 h-4 w-4" />
								{mode === "create"
									? "Create Booking"
									: "Save Changes"}
							</>
						)}
					</Button>
				) : (
					<Button
						type="button"
						onClick={onNext}
						disabled={isNavigating}
					>
						Next
						<ChevronRightIcon className="ml-2 h-4 w-4" />
					</Button>
				)}
			</div>
		</div>
	);
}
