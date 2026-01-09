"use client";

import { cn } from "@repo/ui/lib/utils";
import { type ReactNode, use } from "react";
import { BookingListSidebar } from "./components/sidebar/BookingListSidebar";

type Props = {
	params: Promise<{ organizationSlug: string; bookingId: string }>;
	children: ReactNode;
};

export default function BookingDetailLayout({ params, children }: Props) {
	const { organizationSlug, bookingId } = use(params);

	return (
		<div className={cn("flex h-full min-h-0 flex-1 overflow-hidden")}>
			<main className="flex min-h-0 flex-1 flex-col overflow-hidden">
				{children}
			</main>

			<aside className="hidden shrink-0 border-l bg-muted/10 md:flex md:w-64 md:flex-col lg:w-72 xl:w-80 min-h-0 overflow-hidden">
				<BookingListSidebar
					organizationSlug={organizationSlug}
					currentBookingId={bookingId}
				/>
			</aside>
		</div>
	);
}
