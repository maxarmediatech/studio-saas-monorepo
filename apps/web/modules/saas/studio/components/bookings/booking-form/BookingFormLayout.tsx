"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

interface BookingFormLayoutProps {
	children: ReactNode;
	stepper: ReactNode;
	mobileStepper: ReactNode;
	footer: ReactNode;
	className?: string;
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
}: BookingFormLayoutProps) {
	return (
		<div className={cn("min-h-[calc(100vh-200px)]", className)}>
			{/* Main Content Grid */}
			<div
				className={cn(
					"grid",
					// Mobile: Single column
					"grid-cols-1",
					// Tablet+: Form | Stepper (stepper on right)
					"md:grid-cols-[1fr_240px]",
					"lg:grid-cols-[1fr_260px]"
				)}
			>
				{/* Form Content - Full width on mobile, left side on desktop */}
				<main className="flex flex-col min-h-[calc(100vh-200px)]">
					{/* Mobile Stepper - Visible only on mobile */}
					<div className="md:hidden sticky top-0 z-10 bg-background border-b px-4 py-3">
						{mobileStepper}
					</div>

					{/* Form Content */}
					<div className="flex-1 p-4 lg:p-6">{children}</div>

					{/* Navigation Footer */}
					<div className="sticky bottom-0 bg-background border-t px-4 py-4 lg:px-6">
						{footer}
					</div>
				</main>

				{/* Stepper Sidebar - Hidden on mobile, right side on desktop */}
				<aside className="hidden md:block border-l bg-muted/30">
					<div className="sticky top-4 p-4 max-h-[calc(100vh-120px)] overflow-y-auto">
						{stepper}
					</div>
				</aside>
			</div>
		</div>
	);
}
