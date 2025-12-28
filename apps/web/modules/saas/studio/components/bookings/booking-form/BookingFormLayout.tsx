"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";
import { BookingStepErrorBoundary } from "./BookingStepErrorBoundary";

interface BookingFormLayoutProps {
	children: ReactNode;
	stepper: ReactNode;
	mobileStepper: ReactNode;
	footer: ReactNode;
	className?: string;
	/** Name of the current step for error boundary display */
	stepName?: string;
	/** Validation error message to announce to screen readers */
	validationErrorMessage?: string | null;
}

/**
 * Main layout wrapper for the booking form wizard
 *
 * Desktop (md+): 2-column layout - Form | Stepper
 * Mobile (<md): Single column with horizontal stepper
 */
export function BookingFormLayout({
	children,
	stepper,
	mobileStepper,
	footer,
	className,
	stepName = "Current",
	validationErrorMessage,
}: BookingFormLayoutProps) {
	return (
		<div
			className={cn(
				"flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden",
				className,
			)}
		>
			{/* Screen reader only validation error announcements */}
			<div
				role="status"
				aria-live="assertive"
				aria-atomic="true"
				className="sr-only"
			>
				{validationErrorMessage}
			</div>

			{/* Form Content - Full width on mobile, left side on desktop */}
			<main className="flex min-h-0 flex-1 flex-col">
				{/* Mobile Stepper - Visible only on mobile */}
				<div className="md:hidden border-b bg-background px-4 py-3">
					{mobileStepper}
				</div>

				<div className="flex min-h-0 flex-1 flex-col">
					{/* Form Content with Error Boundary */}
					<div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
						<BookingStepErrorBoundary stepName={stepName}>
							{children}
						</BookingStepErrorBoundary>
					</div>

					{/* Navigation Footer */}
					<div className="border-t bg-background px-4 py-4 lg:px-6">
						{footer}
					</div>
				</div>
			</main>

			{/* Stepper Sidebar - Hidden on mobile, right side on desktop */}
			<aside className="hidden md:flex md:w-[240px] lg:w-[260px] shrink-0 flex-col border-l bg-muted/30">
				<div className="flex-1 overflow-y-auto p-4 lg:p-6">
					{stepper}
				</div>
			</aside>
		</div>
	);
}
