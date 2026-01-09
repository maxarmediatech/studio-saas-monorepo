"use client";

import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
	CustomTabsContent,
	CustomTabsList,
	CustomTabsTrigger,
	Tabs,
} from "@repo/ui/components/tabs";
import {
	Camera,
	CheckSquare,
	IndianRupee,
	Info,
	Package,
} from "lucide-react";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { formatPackageType } from "./utils";

// Import tab components
import { DeliverablesTab } from "./tabs/DeliverablesTab";
import { FinancesTab } from "./tabs/FinancesTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { ShootsTab } from "./tabs/ShootsTab";
import { TasksTab } from "./tabs/TasksTab";

// ============================================================================
// Types
// ============================================================================

interface BookingTabsProps {
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

// ============================================================================
// Constants
// ============================================================================

const TABS = [
	{ id: "overview", label: "Overview", icon: Info },
	{ id: "shoots", label: "Shoots", icon: Camera },
	{ id: "deliverables", label: "Deliverables", icon: Package },
	{ id: "tasks", label: "Tasks", icon: CheckSquare },
	{ id: "finances", label: "Finances", icon: IndianRupee },
] as const;

// ============================================================================
// Main Component
// ============================================================================

export function BookingTabs({ bookingId, booking }: BookingTabsProps) {
	const headerRef = useRef<HTMLDivElement>(null);
	const [headerHeight, setHeaderHeight] = useState(0);

	// Measure header height for ScrollArea calculation
	useEffect(() => {
		if (headerRef.current) {
			setHeaderHeight(headerRef.current.offsetHeight);
		}
	}, [booking]);

	// Resize observer for dynamic header height
	useEffect(() => {
		if (!headerRef.current) return;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setHeaderHeight(entry.contentRect.height);
			}
		});

		resizeObserver.observe(headerRef.current);
		return () => resizeObserver.disconnect();
	}, []);

	return (
		<Tabs
			defaultValue="overview"
			className="h-full flex-1 flex flex-col gap-0"
		>
			{/* Fixed Header Section */}
			<div ref={headerRef} className="flex-shrink-0 border-b bg-background">
				{/* Title Row */}
				<div className="px-6 pt-6 pb-4 space-y-4">
					<div className="space-y-3">
						<h2 className="text-2xl font-bold tracking-tight">
							{booking.name}
						</h2>
						<p className="text-xs text-muted-foreground">
							{booking.createdAt && (
								<>
									Booked on{" "}
									<span className="font-medium text-foreground">
										{format(new Date(booking.createdAt), "MMM d, yyyy")}
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
										{formatPackageType(booking.bookingType, { fallback: "—" })}
									</span>
								</>
							)}
						</p>
					</div>
				</div>

				{/* Tab Navigation */}
				<div className="px-6">
					<CustomTabsList>
						{TABS.map((tab) => (
							<CustomTabsTrigger key={tab.id} value={tab.id}>
								<tab.icon className="h-4 w-4 mr-2" />
								{tab.label}
							</CustomTabsTrigger>
						))}
					</CustomTabsList>
				</div>
			</div>

			{/* Scrollable Tab Content */}
			<ScrollArea
				className="flex-1"
				style={{ height: `calc(100% - ${headerHeight}px)` }}
			>
				<div className="px-6 py-6">
					<CustomTabsContent value="overview">
						<OverviewTab
							bookingId={bookingId}
							booking={booking}
						/>
					</CustomTabsContent>

					<CustomTabsContent value="shoots">
						<ShootsTab bookingId={bookingId} />
					</CustomTabsContent>

					<CustomTabsContent value="deliverables">
						<DeliverablesTab bookingId={bookingId} />
					</CustomTabsContent>

					<CustomTabsContent value="tasks">
						<TasksTab bookingId={bookingId} />
					</CustomTabsContent>

					<CustomTabsContent value="finances">
						<FinancesTab
							bookingId={bookingId}
							packageCost={booking.packageCost}
							totalReceived={booking.totalReceived}
							balance={booking.balance}
						/>
					</CustomTabsContent>
				</div>
			</ScrollArea>
		</Tabs>
	);
}
