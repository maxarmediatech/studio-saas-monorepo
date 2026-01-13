"use client";

import {
	ScrollSpy,
	ScrollSpyLink,
	ScrollSpyNav,
	ScrollSpySection,
	ScrollSpyViewport,
} from "@repo/ui/components/scroll-spy";
import { cn } from "@repo/ui/lib/utils";
import { shootsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	Calendar,
	Camera,
	CheckSquare,
	IndianRupee,
	Package,
} from "lucide-react";
import * as React from "react";
import { DeliverablesTab } from "./tabs/DeliverablesTab";
import { FinancesTab } from "./tabs/FinancesTab";
import { ShootsTab } from "./tabs/ShootsTab";
import { TasksTab } from "./tabs/TasksTab";
import { formatCurrency, formatPackageType } from "./utils";

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

	const { data: shootsData } = useQuery({
		...shootsApi.listOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const shoots = shootsData?.data ?? [];
	const shootsCompleted = shoots.filter(
		(s) => s.status === "completed",
	).length;
	const balanceNum = Number.parseFloat(booking.balance) || 0;

	const clients =
		booking.participants
			?.map((p) => p.client)
			.filter((c): c is NonNullable<typeof c> => !!c) ?? [];

	return (
		<div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
			<div className="mx-auto w-full max-w-4xl flex flex-1 flex-col min-h-0 px-6">
				<ScrollSpy
					offset={20}
					orientation="vertical"
					scrollContainer={scrollContainer}
					className="flex flex-1 flex-col min-h-0"
				>
					<div className="flex-shrink-0 -mx-6">
						<div className="2xl:border-x bg-card overflow-hidden">
							<div className="px-6 pt-4 pb-6 ">
								{booking.createdAt && (
									<div className="flex justify-end mb-3">
										<div className="flex items-center gap-1.5 text-xs">
											<Calendar className="h-3 w-3 text-muted-foreground" />
											<span className="text-muted-foreground">
												Booking date
											</span>
											<span className="font-semibold text-foreground">
												{format(
													new Date(booking.createdAt),
													"MMM d, yyyy",
												)}
											</span>
										</div>
									</div>
								)}

								<h2 className="text-2xl font-bold tracking-tight mb-1.5">
									{booking.name}
								</h2>

								{(booking.bookingType ||
									booking.packageType) && (
									<div className="flex items-center flex-wrap gap-x-3 text-sm text-muted-foreground">
										{booking.bookingType && (
											<span>
												<span className="text-muted-foreground text-xs">
													Booking type
												</span>{" "}
												<span className="font-semibold text-foreground">
													{formatPackageType(
														booking.bookingType,
													)}
												</span>
											</span>
										)}
										{booking.packageType && (
											<span>
												<span className="text-muted-foreground text-xs">
													Package type
												</span>{" "}
												<span className="font-semibold text-foreground">
													{formatPackageType(
														booking.packageType,
													)}
												</span>
											</span>
										)}
									</div>
								)}
								{clients.length > 0 && (
									<div className="flex justify-end text-sm text-muted-foreground mt-3">
										<span className="font-semibold text-foreground/90">
											{clients
												.map((client) => client.name)
												.join(" / ")}
										</span>
									</div>
								)}
							</div>

							<div className="px-6 py-3">
								<div className="grid grid-cols-3 gap-1  bg-muted/60  p-1 rounded-xl">
									{/* Package Cost */}
									<div className="bg-card rounded-lg border p-3">
										<div className="flex items-center justify-between mb-1">
											<span className="text-xs font-medium text-muted-foreground">
												Package
											</span>
											<IndianRupee className="h-4 w-4 text-muted-foreground/50" />
										</div>
										<p className="text-lg font-semibold">
											{formatCurrency(
												booking.packageCost,
											)}
										</p>
									</div>

									{/* Amount Received */}
									<div className="bg-card rounded-lg border p-3">
										<div className="flex items-center justify-between mb-1">
											<span className="text-xs font-medium text-muted-foreground">
												Received
											</span>
											<IndianRupee className="h-4 w-4 text-muted-foreground/50" />
										</div>
										<p
											className={cn(
												"text-lg font-semibold",
												balanceNum > 0
													? "text-emerald-600"
													: "text-foreground",
											)}
										>
											{formatCurrency(
												booking.totalReceived,
											)}
										</p>
									</div>

									{/* Shoots */}
									<div className="bg-card rounded-lg border p-3">
										<div className="flex items-center justify-between mb-1">
											<span className="text-xs font-medium text-muted-foreground">
												Shoots
											</span>
											<Camera className="h-4 w-4 text-muted-foreground/50" />
										</div>
										<p className="text-lg font-semibold">
											{shootsCompleted}/{shoots.length}
											<span className="text-sm font-normal text-muted-foreground ml-1">
												completed
											</span>
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>

					<ScrollSpyNav className="flex-shrink-0 border-y 2xl:border-x bg-muted/30 -mx-6 px-6">
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
						className="flex-1 min-h-0 overflow-y-auto vertical-scrollbar scrollbar-sm -mx-6 2xl:border-x 2xl:border-b 2xl:rounded-b-xl"
					>
						<div className="px-6 py-6 space-y-16 pb-32">
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
