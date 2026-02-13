"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import { useConfigurationViewParams } from "@saas/studio/hooks/params/use-configuration-view-params";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, PencilIcon } from "lucide-react";
import { useState } from "react";

const CONFIG_TYPE_LABELS: Record<string, string> = {
	booking_type: "Booking Type",
	package_type: "Package Type",
	relation_type: "Relation Type",
	event_type: "Event Type",
	shoot_status: "Shoot Status",
	crew_role: "Specialisation",
	task_status: "Task Status",
	task_priority: "Task Priority",
	deliverable_status: "Deliverable Status",
	deliverable_priority: "Deliverable Priority",
	expense_category: "Expense Category",
};

function formatCurrency(value: string | number): string {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(Number(value));
}

function formatDate(dateString: string): string {
	return new Date(dateString).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function ConfigurationDetailSheet() {
	const { configurationId, close } = useConfigurationViewParams();
	const { openEdit } = useConfigurationParams();
	const isOpen = Boolean(configurationId);
	const [isScrolled, setIsScrolled] = useState(false);

	const {
		data: configuration,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...configurationsApi.getOptions(configurationId ?? ""),
		enabled: isOpen && !!configurationId,
	});

	// Fetch booking types for label resolution (package_type, event_type, relation_type)
	const { data: bookingTypesData } = useQuery({
		...configurationsApi.bookingTypesOptions(),
		enabled: isOpen,
	});
	const bookingTypes = bookingTypesData?.data ?? [];

	// Fetch relation types for label resolution (booking_type → Applicable Roles)
	const { data: relationTypesData } = useQuery({
		...configurationsApi.relationTypesOptions(),
		enabled: isOpen,
	});
	const relationTypes = relationTypesData?.data ?? [];

	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		setIsScrolled(e.currentTarget.scrollTop > 0);
	};

	const config = configuration?.data;
	const typeLabel = config
		? (CONFIG_TYPE_LABELS[config.type] ?? config.type)
		: "";
	const isPackageType = config?.type === "package_type";
	const isBookingType = config?.type === "booking_type";
	const isRelationType = config?.type === "relation_type";
	const isEventType = config?.type === "event_type";
	const metadata = config?.metadata as Record<string, unknown> | null;
	const defaultDeliverables = Array.isArray(metadata?.defaultDeliverables)
		? metadata.defaultDeliverables.filter(
				(deliverable): deliverable is string =>
					typeof deliverable === "string",
			)
		: [];

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent
				side="right"
				className="sm:max-w-md p-0 gap-0 flex flex-col"
			>
				<SheetHeader
					className={cn(
						"shrink-0 px-6 py-4 transition-shadow duration-200",
						isScrolled &&
							"shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]",
					)}
				>
					{isLoading ? (
						<>
							<SheetTitle className="sr-only">
								Loading configuration details
							</SheetTitle>
							<div className="space-y-3">
								<Skeleton className="h-8 w-3/4" />
								<Skeleton className="h-5 w-1/2" />
								<div className="flex gap-2">
									<Skeleton className="h-6 w-16" />
									<Skeleton className="h-6 w-16" />
								</div>
							</div>
						</>
					) : (
						<>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									{config?.color && (
										<div
											className="h-5 w-5 rounded-full border shrink-0"
											style={{
												backgroundColor: config.color,
											}}
										/>
									)}
									<div>
										<SheetTitle className="text-xl font-semibold">
											{config?.label}
										</SheetTitle>
										<p className="text-sm text-muted-foreground font-mono">
											{config?.key}
										</p>
									</div>
								</div>
								<Button
									variant="ghost"
									size="icon"
									aria-label="Edit configuration"
									onClick={() => {
										if (configurationId && config) {
											close();
											openEdit(
												configurationId,
												config.type,
											);
										}
									}}
								>
									<PencilIcon className="h-4 w-4" />
								</Button>
							</div>
							<div className="flex items-center gap-2 pt-2">
								{config?.isActive ? (
									<Badge
										variant="outline"
										className="text-green-600 border-green-200 bg-green-50"
									>
										Active
									</Badge>
								) : (
									<Badge
										variant="outline"
										className="text-muted-foreground"
									>
										Inactive
									</Badge>
								)}
								<Badge
									variant={
										config?.isSystem
											? "secondary"
											: "outline"
									}
								>
									{config?.isSystem ? "System" : "Custom"}
								</Badge>
							</div>
						</>
					)}
				</SheetHeader>
				<div
					className="flex-1 min-h-0 overflow-y-auto"
					onScroll={handleScroll}
				>
					{isLoading ? (
						<div className="space-y-4 px-6 py-4">
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
						</div>
					) : isError ? (
						<div className="flex flex-col items-center gap-2 py-8 px-6 text-center">
							<AlertCircleIcon className="h-10 w-10 text-destructive/50" />
							<p className="text-sm text-destructive">
								Failed to load configuration
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={() => refetch()}
							>
								Try again
							</Button>
						</div>
					) : config ? (
						<div className="px-6 py-4 space-y-6">
							{/* Details */}
							<div className="space-y-4">
								<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
									Details
								</h3>
								<DetailRow label="Type" value={typeLabel} />
								<DetailRow
									label="Description"
									value={
										config.description || "No description"
									}
									muted={!config.description}
								/>
								<DetailRow
									label="Sort Order"
									value={String(config.sortOrder)}
									mono
								/>
								<DetailRow
									label="Default"
									value={config.isDefault ? "Yes" : "No"}
								/>
								<DetailRow
									label="Created"
									value={formatDate(config.createdAt)}
								/>
								<DetailRow
									label="Updated"
									value={formatDate(config.updatedAt)}
								/>
							</div>

							{/* Package Type details */}
							{isPackageType && (
								<div className="space-y-4">
									<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
										Package Details
									</h3>
									<DetailRow
										label="Default Cost"
										value={
											config.defaultCost
												? formatCurrency(
														config.defaultCost,
													)
												: "Not set"
										}
										mono={!!config.defaultCost}
										muted={!config.defaultCost}
									/>
									<DetailRow
										label="Booking Type"
										value={
											config.bookingTypeFilter
												? (bookingTypes.find(
														(bt) =>
															bt.key ===
															config.bookingTypeFilter,
													)?.label ??
													config.bookingTypeFilter)
												: "All"
										}
										muted={!config.bookingTypeFilter}
									/>
										{defaultDeliverables.length > 0 && (
												<div>
													<p className="text-sm text-muted-foreground mb-2">
														Default Deliverables
													</p>
													<div className="flex flex-wrap gap-1">
														{defaultDeliverables.map((d, index) => (
															<Badge
																key={index}
																variant="outline"
															className="text-xs font-normal"
														>
															{d}
														</Badge>
													))}
												</div>
											</div>
										)}
								</div>
							)}

							{/* Booking Type → Applicable Roles */}
							{isBookingType && (
								<div className="space-y-4">
									<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
										Applicable Roles
									</h3>
									<BadgeList
										keys={metadata?.roles}
										lookup={relationTypes}
										emptyLabel="All roles"
									/>
								</div>
							)}

							{/* Event Type / Relation Type → Applicable Booking Types */}
							{(isEventType || isRelationType) && (
								<div className="space-y-4">
									<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
										Applicable Booking Types
									</h3>
									<BadgeList
										keys={metadata?.bookingTypes}
										lookup={bookingTypes}
										emptyLabel="All types"
									/>
								</div>
							)}
						</div>
					) : null}
				</div>
			</SheetContent>
		</Sheet>
	);
}

function DetailRow({
	label,
	value,
	mono,
	muted,
}: {
	label: string;
	value: string;
	mono?: boolean;
	muted?: boolean;
}) {
	return (
		<div className="flex items-start justify-between gap-4">
			<span className="text-sm text-muted-foreground shrink-0">
				{label}
			</span>
			<span
				className={cn(
					"text-sm text-right",
					mono && "font-mono",
					muted && "text-muted-foreground italic",
				)}
			>
				{value}
			</span>
		</div>
	);
}

function BadgeList({
	keys,
	lookup,
	emptyLabel,
}: {
	keys: unknown;
	lookup: Array<{ key: string; label: string; color?: string | null }>;
	emptyLabel: string;
}) {
	if (!Array.isArray(keys) || keys.length === 0) {
		return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
	}
	return (
		<div className="flex flex-wrap gap-1.5">
			{keys.map((key: string) => {
				const match = lookup.find((item) => item.key === key);
				return (
					<Badge
						key={key}
						variant="outline"
						className="gap-1.5 text-xs font-normal"
					>
						{match?.color && (
							<div
								className="h-2 w-2 rounded-full"
								style={{ backgroundColor: match.color }}
							/>
						)}
						{match?.label ?? key}
					</Badge>
				);
			})}
		</div>
	);
}
