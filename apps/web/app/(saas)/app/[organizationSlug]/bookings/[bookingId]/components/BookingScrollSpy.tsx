"use client";

import {
	ScrollSpy,
	ScrollSpyLink,
	ScrollSpyNav,
	ScrollSpySection,
	ScrollSpyViewport,
} from "@repo/ui/components/scroll-spy";
import { format } from "date-fns";
import {
	Calendar,
	Camera,
	CheckSquare,
	IndianRupee,
	Info,
	Package,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";
import { deliverablesApi, shootsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { DeliverablesTab } from "./tabs/DeliverablesTab";
import { FinancesTab } from "./tabs/FinancesTab";
import { OverviewTab } from "./tabs/OverviewTab";
import { ShootsTab } from "./tabs/ShootsTab";
import { TasksTab } from "./tabs/TasksTab";
import { formatCurrency, formatPackageType, getStatusVariant } from "./utils";

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

	const { data: shootsData } = useQuery({
		...shootsApi.listOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const { data: deliverablesData } = useQuery({
		...deliverablesApi.listOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const shoots = shootsData?.data ?? [];
	const deliverables = deliverablesData?.data ?? [];

	const packageCostNum = Number.parseFloat(booking.packageCost) || 0;
	const totalReceivedNum = Number.parseFloat(booking.totalReceived) || 0;
	const balanceNum = Number.parseFloat(booking.balance) || 0;

	const hasAdvancePayment = totalReceivedNum > 0;
	const shootsCompleted =
		shoots.length > 0 && shoots.every((s) => s.status === "completed");
	const deliverablesCompleted =
		deliverables.length > 0 &&
		deliverables.every((d) => d.status === "completed");
	const isFullyPaid =
		totalReceivedNum >= packageCostNum && packageCostNum > 0;

	const milestones = [
		{ label: "Deposit", active: hasAdvancePayment },
		{ label: "Shoots", active: shootsCompleted },
		{ label: "Delivery", active: deliverablesCompleted },
		{ label: "Paid", active: isFullyPaid },
	];

	const completedMilestones = milestones.filter((m) => m.active).length;

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
							<div className="px-6 py-5 border-b">
								<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
									<div className="space-y-1.5">
										<div className="flex items-center gap-3">
											<h2 className="text-2xl font-bold tracking-tight">
												{booking.name}
											</h2>
											<Badge
												variant={getStatusVariant(
													booking.status,
												)}
											>
												{booking.status}
											</Badge>
										</div>
										<div className="flex items-center gap-4 text-sm text-muted-foreground">
											{booking.createdAt && (
												<div className="flex items-center gap-1.5">
													<Calendar className="h-3.5 w-3.5" />
													<span>
														{format(
															new Date(
																booking.createdAt,
															),
															"MMM d, yyyy",
														)}
													</span>
												</div>
											)}
											{booking.bookingType && (
												<div className="flex items-center gap-1.5">
													<Package className="h-3.5 w-3.5" />
													<span>
														{formatPackageType(
															booking.bookingType,
														)}
													</span>
												</div>
											)}
										</div>
									</div>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x bg-muted/10">
								<div className="p-4 flex flex-col justify-center">
									<span className="text-xs font-medium text-muted-foreground mb-1">
										Package Cost
									</span>
									<div className="flex items-baseline gap-2">
										<span className="text-lg font-semibold">
											{formatCurrency(
												booking.packageCost,
											)}
										</span>
									</div>
									<span className="text-[10px] text-muted-foreground truncate">
										{formatPackageType(booking.packageType)}
									</span>
								</div>

								<div className="p-4 flex flex-col justify-center">
									<span className="text-xs font-medium text-muted-foreground mb-1">
										Received
									</span>
									<div className="flex items-baseline gap-2">
										<span className="text-lg font-semibold text-emerald-600 dark:text-emerald-500">
											{formatCurrency(
												booking.totalReceived,
											)}
										</span>
									</div>
									<div className="w-full bg-muted/50 rounded-full h-1 mt-2 overflow-hidden">
										<div
											className="bg-emerald-500 h-full rounded-full transition-all duration-500"
											style={{
												width: `${Math.min(
													(totalReceivedNum /
														(packageCostNum || 1)) *
														100,
													100,
												)}%`,
											}}
										/>
									</div>
								</div>

								<div className="p-4 flex flex-col justify-center">
									<span className="text-xs font-medium text-muted-foreground mb-1">
										Balance
									</span>
									<div className="flex items-baseline gap-2">
										<span
											className={cn(
												"text-lg font-semibold",
												balanceNum > 0
													? "text-amber-600 dark:text-amber-500"
													: "text-muted-foreground",
											)}
										>
											{formatCurrency(booking.balance)}
										</span>
									</div>
									<span className="text-[10px] text-muted-foreground">
										{balanceNum > 0
											? "Payment pending"
											: "Fully paid"}
									</span>
								</div>

								<div className="p-4 flex flex-col justify-center">
									<div className="flex justify-between items-center mb-2">
										<span className="text-xs font-medium text-muted-foreground">
											Progress
										</span>
										<span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
											{completedMilestones}/4
										</span>
									</div>
									<div className="flex gap-1 h-1.5 mb-1.5">
										{milestones.map((m) => (
											<div
												key={m.label}
												className={cn(
													"flex-1 rounded-full transition-colors",
													m.active
														? "bg-primary"
														: "bg-muted-foreground/20",
												)}
											/>
										))}
									</div>
									<div className="flex justify-between text-[10px] text-muted-foreground">
										<span>Start</span>
										<span>Finish</span>
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
