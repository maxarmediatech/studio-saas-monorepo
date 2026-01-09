"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

interface BookingDetailLayoutProps {
	/** Header section: back button, title, badges, actions */
	header: ReactNode;
	/** Main content area: stepper, shoots, deliverables, payments cards */
	children: ReactNode;
	/** Sidebar: contextual info cards (note, client, venue, contact, stats) */
	sidebar: ReactNode;
	className?: string;
}

/**
 * Layout wrapper for the booking detail page
 *
 * Uses same constrained-width pattern as BookingFormLayout:
 * - Main content constrained to max-w-4xl, centered
 * - Fixed-width sidebar on right (responsive: md:w-64 -> xl:w-80)
 * - Header spans full width above content
 * - Status stepper is now part of main content (not separate header section)
 *
 * Desktop layout (md+):
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Header (back, title, badges, actions)                        │
 * ├───────────────────────────────────────────┬─────────────────┤
 * │ Main Content (max-w-4xl centered)         │ Sidebar (fixed) │
 * │ - Status Stepper (card)                   │ - Scrollable    │
 * │ - Shoots, Deliverables, Payments          │ - Info cards    │
 * └───────────────────────────────────────────┴─────────────────┘
 *
 * Mobile layout (<md):
 * ┌──────────────────────────────────────┐
 * │ Header                               │
 * ├──────────────────────────────────────┤
 * │ Sidebar (stacked above main)         │
 * ├──────────────────────────────────────┤
 * │ Main Content (stepper + cards)       │
 * └──────────────────────────────────────┘
 */
export function BookingDetailLayout({
	header,
	children,
	sidebar,
	className,
}: BookingDetailLayoutProps) {
	return (
		<div className={cn("flex h-full min-h-0 flex-1 flex-col", className)}>
			{/* Header - spans full width, fixed at top */}
			<header className="shrink-0 border-b bg-background">
				<div className="px-4 py-3 sm:px-6 lg:px-8">{header}</div>
			</header>

			{/* Main body - two columns on desktop, stacked on mobile */}
			<div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
				{/* Main content area - scrollable, constrained width */}
				<main className="flex min-h-0 flex-1 flex-col">
					<div className="flex-1 overflow-y-auto">
						<div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
							<div className="space-y-6">{children}</div>
						</div>
					</div>
				</main>

				{/* Contextual sidebar - scrollable, responsive width */}
				<aside className="shrink-0 border-b bg-muted/10 md:flex md:w-64 md:flex-col md:border-b-0 md:border-l lg:w-72 xl:w-80">
					<div className="flex-1 overflow-y-auto p-4 lg:p-6">
						<div className="space-y-4">{sidebar}</div>
					</div>
				</aside>
			</div>
		</div>
	);
}
