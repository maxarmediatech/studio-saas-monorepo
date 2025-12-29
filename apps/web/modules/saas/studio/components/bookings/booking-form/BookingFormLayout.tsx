"use client";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
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
	/** Back link URL */
	backHref?: string;
	/** Page title */
	title?: string;
	/** Cancel handler for the header button */
	onCancel?: () => void;
}

/**
 * Main layout wrapper for the booking form wizard
 *
 * Layout structure (desktop):
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Header (spans full width)                                    │
 * ├─────────────────────────────────────────────┬───────────────┤
 * │ Form Content (centered, scrollable)         │ Stepper       │
 * │                                             │ Sidebar       │
 * ├─────────────────────────────────────────────┤ (fixed)       │
 * │ Footer (Previous/Next) - fixed bottom       │               │
 * └─────────────────────────────────────────────┴───────────────┘
 *
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
	backHref,
	title = "New Booking",
	onCancel,
}: BookingFormLayoutProps) {
	return (
		<div
			className={cn(
				"flex h-full min-h-0 flex-1 flex-col",
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

			{/* Header - spans full width, fixed at top */}
			<header className="shrink-0 border-b bg-background">
				<div className="flex h-14 items-center justify-between px-4 sm:h-16 lg:px-6">
					<div className="flex items-center gap-2">
						{backHref && (
							<Link
								href={backHref}
								className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							>
								<ChevronLeft className="size-5" />
								<span className="sr-only">Back to bookings</span>
							</Link>
						)}
						<h1 className="text-lg font-semibold">{title}</h1>
					</div>
					{onCancel && (
						<Button
							type="button"
							variant="ghost"
							onClick={onCancel}
							className="text-muted-foreground"
						>
							Cancel
						</Button>
					)}
				</div>
			</header>

			{/* Mobile Stepper - Visible only on mobile */}
			<div className="shrink-0 border-b bg-background px-4 py-3 md:hidden">
				{mobileStepper}
			</div>

			{/* Main body - flex row on desktop */}
			<div className="flex min-h-0 flex-1 flex-col md:flex-row">
				{/* Content + Footer column */}
				<main className="flex min-h-0 flex-1 flex-col">
					{/* Scrollable content area */}
					<div className="flex-1 overflow-y-auto">
						<div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
							<BookingStepErrorBoundary stepName={stepName}>
								{children}
							</BookingStepErrorBoundary>
						</div>
					</div>

					{/* Navigation Footer - fixed at bottom, not scrollable */}
					<footer className="shrink-0 border-t bg-background">
						<div className="mx-auto max-w-4xl px-4 py-4 lg:px-6">
							{footer}
						</div>
					</footer>
				</main>

				{/* Right Stepper Sidebar - flush to edge, no outer padding */}
				<aside className="hidden shrink-0 flex-col border-l bg-muted/30 md:flex md:w-64 lg:w-72 xl:w-80">
					<div className="flex-1 overflow-y-auto p-4 lg:p-6">
						{stepper}
					</div>
				</aside>
			</div>
		</div>
	);
}
