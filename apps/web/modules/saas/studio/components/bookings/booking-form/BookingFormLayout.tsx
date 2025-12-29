"use client";

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
}

/**
 * Main layout wrapper for the booking form wizard
 *
 * Layout structure:
 * - Left: App sidebar (handled by parent)
 * - Center: Header + scrollable form content + fixed footer
 * - Right: Stepper sidebar (flush to edge)
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
	backHref,
	title = "New Booking",
}: BookingFormLayoutProps) {
	return (
		<div
			className={cn(
				"flex h-full min-h-0 flex-1 flex-col md:flex-row",
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

			{/* Main content area - grows to fill space between sidebars */}
			<main className="flex min-h-0 flex-1 flex-col">
				{/* Header - fixed at top, not scrollable */}
				<header className="shrink-0 border-b bg-background">
					<div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-4 sm:h-16 lg:px-6">
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
				</header>

				{/* Mobile Stepper - Visible only on mobile */}
				<div className="shrink-0 border-b bg-background px-4 py-3 md:hidden">
					{mobileStepper}
				</div>

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
	);
}
