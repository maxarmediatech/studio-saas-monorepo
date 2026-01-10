"use client";

import * as React from "react";
import { format } from "date-fns";
import { Camera, CheckSquare, IndianRupee, Info, Package } from "lucide-react";
import {
	ScrollSpy,
	ScrollSpyLink,
	ScrollSpyNav,
	ScrollSpySection,
	ScrollSpyViewport,
} from "@repo/ui/components/scroll-spy";
import { formatPackageType } from "./utils";

import { DeliverablesTab } from "./tabs/DeliverablesTab";
import { FinancesTab } from "./tabs/FinancesTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { ShootsTab } from "./tabs/ShootsTab";
import { TasksTab } from "./tabs/TasksTab";

interface BookingScrollSpyProps {
	bookingId: string;
	booking: {
		name: string;
		status: string;
		bookingType?: string | null;
		packageType?: string | null;
		packageCost: string;
		totalReceived: string;
		balance: string;
		note?: string | null;
		createdAt?: string | Date;
		participants?: Array<{
			client?: { id: string; name: string; email?: string | null } | null;
		}>;
	};
}

const SECTIONS = [
	{ id: "overview", label: "Overview", icon: Info },
	{ id: "shoots", label: "Shoots", icon: Camera },
	{ id: "deliverables", label: "Deliverables", icon: Package },
	{ id: "tasks", label: "Tasks", icon: CheckSquare },
	{ id: "finances", label: "Finances", icon: IndianRupee },
] as const;

export function BookingScrollSpy({
	bookingId,
	booking,
}: BookingScrollSpyProps) {
	const [scrollContainer, setScrollContainer] =
		React.useState<HTMLDivElement | null>(null);

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
			<div className="mx-auto w-full max-w-4xl flex flex-1 flex-col min-h-0 px-6">
				<ScrollSpy
					offset={20}
					orientation="vertical"
					scrollContainer={scrollContainer}
					className="flex flex-1 flex-col min-h-0"
				>
					<div className="flex-shrink-0 pt-6 pb-4 space-y-3">
						<h2 className="text-2xl font-bold tracking-tight">
							{booking.name}
						</h2>
						<p className="text-xs text-muted-foreground">
							{booking.createdAt && (
								<>
									Booked on{" "}
									<span className="font-medium text-foreground">
										{format(
											new Date(booking.createdAt),
											"MMM d, yyyy",
										)}
									</span>
								</>
							)}
							{booking.createdAt && booking.bookingType && (
								<span className="mx-2">·</span>
							)}
							{booking.bookingType && (
								<>
									Booking Type:{" "}
									<span className="font-medium text-foreground">
										{formatPackageType(
											booking.bookingType,
											{ fallback: "—" },
										)}
									</span>
								</>
							)}
						</p>
					</div>

					<ScrollSpyNav className="flex-shrink-0 border-y bg-muted/30 -mx-6 px-6">
						{SECTIONS.map((section) => (
							<ScrollSpyLink
								key={section.id}
								value={section.id}
								className="flex items-center gap-2 py-3"
							>
								<section.icon className="h-4 w-4" />
								{section.label}
							</ScrollSpyLink>
						))}
					</ScrollSpyNav>

					<ScrollSpyViewport
						ref={setScrollContainer}
						className="flex-1 min-h-0 overflow-y-auto"
					>
						<div className="py-6 space-y-16 pb-32">
							<ScrollSpySection value="overview">
								<h3 className="font-bold text-2xl mb-2">
									Overview
								</h3>
								<p className="text-muted-foreground mb-6">
									Booking summary and milestone progress.
								</p>
								<OverviewTab
									bookingId={bookingId}
									booking={booking}
								/>
							</ScrollSpySection>

							<ScrollSpySection value="shoots">
								<h3 className="font-bold text-2xl mb-2">
									Shoots
								</h3>
								<p className="text-muted-foreground mb-6">
									All scheduled photo/video sessions.
								</p>
								<ShootsTab bookingId={bookingId} />
							</ScrollSpySection>

							<ScrollSpySection value="deliverables">
								<h3 className="font-bold text-2xl mb-2">
									Deliverables
								</h3>
								<p className="text-muted-foreground mb-6">
									Photos, videos, and other deliverable items.
								</p>
								<DeliverablesTab bookingId={bookingId} />
							</ScrollSpySection>

							<ScrollSpySection value="tasks">
								<h3 className="font-bold text-2xl mb-2">
									Tasks
								</h3>
								<p className="text-muted-foreground mb-6">
									To-do items and action items for this
									booking.
								</p>
								<TasksTab bookingId={bookingId} />
							</ScrollSpySection>

							<ScrollSpySection value="finances">
								<h3 className="font-bold text-2xl mb-2">
									Finances
								</h3>
								<p className="text-muted-foreground mb-6">
									Payments, expenses, and financial summary.
								</p>
								<FinancesTab
									bookingId={bookingId}
									packageCost={booking.packageCost}
									totalReceived={booking.totalReceived}
									balance={booking.balance}
								/>
							</ScrollSpySection>
						</div>
					</ScrollSpyViewport>
				</ScrollSpy>
			</div>
		</div>
	);
}
