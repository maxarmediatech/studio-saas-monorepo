"use client";

import { cn } from "@repo/ui/lib/utils";
import { type ReactNode, use } from "react";
import { BookingListSidebar } from "./components/sidebar/BookingListSidebar";
import {
	BookingSidebarProvider,
	useBookingSidebar,
} from "./components/sidebar/booking-sidebar-context";

type Props = {
	params: Promise<{ organizationSlug: string; bookingId: string }>;
	children: ReactNode;
};

function BookingDetailLayoutInner({
	organizationSlug,
	bookingId,
	children,
}: {
	organizationSlug: string;
	bookingId: string;
	children: ReactNode;
}) {
	const { isExpanded } = useBookingSidebar();

	return (
		<div className={cn("flex h-full min-h-0 flex-1 overflow-hidden")}>
			{/* Main content - shrinks when sidebar is open */}
			<main className="flex min-h-0 flex-1 flex-col overflow-hidden">
				{children}
			</main>

			{/* Collapsible sidebar - hidden on mobile, width animates */}
			<aside
				className={cn(
					"hidden shrink-0 flex-col border-l bg-muted/10 md:flex",
					"transition-[width] duration-300 ease-in-out overflow-hidden",
					isExpanded ? "w-72 lg:w-80" : "w-0",
				)}
			>
				{/* Inner container maintains layout when animating */}
				<div className="h-full w-72 lg:w-80">
					<BookingListSidebar
						organizationSlug={organizationSlug}
						currentBookingId={bookingId}
					/>
				</div>
			</aside>
		</div>
	);
}

export default function BookingDetailLayout({ params, children }: Props) {
	const { organizationSlug, bookingId } = use(params);

	return (
		<BookingSidebarProvider>
			<BookingDetailLayoutInner
				organizationSlug={organizationSlug}
				bookingId={bookingId}
			>
				{children}
			</BookingDetailLayoutInner>
		</BookingSidebarProvider>
	);
}
