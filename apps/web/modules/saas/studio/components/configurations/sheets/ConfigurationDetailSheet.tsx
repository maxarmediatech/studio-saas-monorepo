"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Separator } from "@repo/ui/components/separator";
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
import {
	AlertCircleIcon,
	CalendarIcon,
	CheckCircle2Icon,
	ClockIcon,
	InfoIcon,
	ListIcon,
	PackageIcon,
	PencilIcon,
	ShieldIcon,
	TagIcon,
	UsersIcon,
	XCircleIcon,
} from "lucide-react";
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

interface Deliverable {
	title: string;
	quantity: number;
	rowKey: string;
}

function normalizeDeliverable(
	value: unknown,
): Omit<Deliverable, "rowKey"> | null {
	if (typeof value === "string") {
		const title = value.trim();
		return title ? { title, quantity: 1 } : null;
	}

	if (typeof value !== "object" || value === null) {
		return null;
	}

	const deliverable = value as { title?: unknown; quantity?: unknown };
	const title =
		typeof deliverable.title === "string"
			? deliverable.title.trim()
			: "";
	const quantity =
		typeof deliverable.quantity === "number"
			? deliverable.quantity
			: typeof deliverable.quantity === "string"
				? Number(deliverable.quantity)
				: NaN;

	if (!title || !Number.isFinite(quantity) || quantity <= 0) {
		return null;
	}

	return { title, quantity };
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
	const defaultDeliverables = (() => {
		if (!Array.isArray(metadata?.defaultDeliverables)) {
			return [] as Deliverable[];
		}

		const duplicateCounts = new Map<string, number>();
		return metadata.defaultDeliverables.reduce<Deliverable[]>(
			(acc, item) => {
				const normalized = normalizeDeliverable(item);
				if (!normalized) {
					return acc;
				}

				const baseKey = `${normalized.title}-${normalized.quantity}`;
				const duplicateCount = duplicateCounts.get(baseKey) ?? 0;
				duplicateCounts.set(baseKey, duplicateCount + 1);

				acc.push({
					...normalized,
					rowKey: `${baseKey}-${duplicateCount}`,
				});
				return acc;
			},
			[],
		);
	})();

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent
				side="right"
				className="sm:max-w-xl p-0 gap-0 flex flex-col"
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
											className="h-10 w-10 rounded-lg border shrink-0"
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
										className="text-green-600 border-green-200 bg-green-50 gap-1"
									>
										<CheckCircle2Icon className="h-3 w-3" />
										Active
									</Badge>
								) : (
									<Badge
										variant="outline"
										className="text-muted-foreground gap-1"
									>
										<XCircleIcon className="h-3 w-3" />
										Inactive
									</Badge>
								)}
								<Badge
									variant={
										config?.isSystem
											? "secondary"
											: "outline"
									}
									className="gap-1"
								>
									<ShieldIcon className="h-3 w-3" />
									{config?.isSystem ? "System" : "Custom"}
								</Badge>
								{config?.isDefault && (
									<Badge
										variant="outline"
										className="text-blue-600 border-blue-200 bg-blue-50 gap-1"
									>
										<TagIcon className="h-3 w-3" />
										Default
									</Badge>
								)}
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
						<div className="px-6 py-4 space-y-4">
							{/* Card A — Overview */}
							<Card className="py-4 gap-3 shadow-none">
								<CardHeader className="px-4 py-0">
									<CardTitle className="flex items-center gap-2 text-sm">
										<InfoIcon className="h-4 w-4 text-muted-foreground" />
										Overview
									</CardTitle>
								</CardHeader>
								<CardContent className="px-4 space-y-3">
									<div className="grid grid-cols-2 gap-3">
										<div>
											<p className="text-xs text-muted-foreground mb-0.5">
												Type
											</p>
											<p className="text-sm font-medium">
												{typeLabel}
											</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground mb-0.5">
												Sort Order
											</p>
											<p className="text-sm font-mono">
												{config.sortOrder}
											</p>
										</div>
									</div>
									{config.description && (
										<div>
											<p className="text-xs text-muted-foreground mb-0.5">
												Description
											</p>
											<p className="text-sm leading-relaxed">
												{config.description}
											</p>
										</div>
									)}
									{config.color && (
										<div>
											<p className="text-xs text-muted-foreground mb-0.5">
												Color
											</p>
											<div className="flex items-center gap-2">
												<div
													className="h-8 w-8 rounded-md border"
													style={{
														backgroundColor:
															config.color,
													}}
												/>
												<span className="text-sm font-mono text-muted-foreground">
													{config.color}
												</span>
											</div>
										</div>
									)}
								</CardContent>
							</Card>

							{/* Card B — Package Type Details */}
							{isPackageType && (
								<Card className="py-4 gap-3 shadow-none">
									<CardHeader className="px-4 py-0">
										<CardTitle className="flex items-center gap-2 text-sm">
											<PackageIcon className="h-4 w-4 text-muted-foreground" />
											Package Details
										</CardTitle>
									</CardHeader>
									<CardContent className="px-4 space-y-3">
										<div>
											<p className="text-xs text-muted-foreground mb-0.5">
												Default Cost
											</p>
											{config.defaultCost ? (
												<p className="text-2xl font-bold">
													{formatCurrency(
														config.defaultCost,
													)}
												</p>
											) : (
												<p className="text-sm text-muted-foreground italic">
													Not set
												</p>
											)}
										</div>
										<div>
											<p className="text-xs text-muted-foreground mb-0.5">
												Booking Type Filter
											</p>
											<p className="text-sm">
												{config.bookingTypeFilter
													? (bookingTypes.find(
															(bt) =>
																bt.key ===
																config.bookingTypeFilter,
														)?.label ??
														config.bookingTypeFilter)
													: "All booking types"}
											</p>
										</div>
										{defaultDeliverables.length > 0 && (
											<div>
												<p className="text-xs text-muted-foreground mb-2">
													Default Deliverables
												</p>
												<div className="rounded-md border">
													<div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-1.5 bg-muted/50 border-b">
														<span className="text-xs font-medium text-muted-foreground">
															Deliverable
														</span>
														<span className="text-xs font-medium text-muted-foreground text-right">
															Qty
														</span>
													</div>
														{defaultDeliverables.map(
															(d, index) => (
																<div
																	key={d.rowKey}
																	className={cn(
																		"grid grid-cols-[1fr_auto] gap-2 px-3 py-2",
																		index <
																		defaultDeliverables.length -
																			1 &&
																		"border-b",
																)}
															>
																<span className="text-sm">
																	{d.title}
																</span>
																<span className="text-sm font-mono text-right">
																	{d.quantity}
																</span>
															</div>
														),
													)}
												</div>
											</div>
										)}
									</CardContent>
								</Card>
							)}

							{/* Card B — Booking Type → Applicable Roles */}
							{isBookingType && (
								<Card className="py-4 gap-3 shadow-none">
									<CardHeader className="px-4 py-0">
										<CardTitle className="flex items-center gap-2 text-sm">
											<UsersIcon className="h-4 w-4 text-muted-foreground" />
											Applicable Roles
										</CardTitle>
									</CardHeader>
									<CardContent className="px-4">
										<BadgeList
											keys={metadata?.roles}
											lookup={relationTypes}
											emptyLabel="All roles"
										/>
									</CardContent>
								</Card>
							)}

							{/* Card B — Event/Relation Type → Applicable Booking Types */}
							{(isEventType || isRelationType) && (
								<Card className="py-4 gap-3 shadow-none">
									<CardHeader className="px-4 py-0">
										<CardTitle className="flex items-center gap-2 text-sm">
											<ListIcon className="h-4 w-4 text-muted-foreground" />
											Applicable Booking Types
										</CardTitle>
									</CardHeader>
									<CardContent className="px-4">
										<BadgeList
											keys={metadata?.bookingTypes}
											lookup={bookingTypes}
											emptyLabel="All types"
										/>
									</CardContent>
								</Card>
							)}

							{/* Footer — System Info */}
							<Separator />
							<div className="grid grid-cols-2 gap-3 pb-2">
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<CalendarIcon className="h-3.5 w-3.5" />
									<span>
										Created{" "}
										{formatDate(config.createdAt)}
									</span>
								</div>
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<ClockIcon className="h-3.5 w-3.5" />
									<span>
										Updated{" "}
										{formatDate(config.updatedAt)}
									</span>
								</div>
							</div>
						</div>
					) : null}
				</div>
			</SheetContent>
		</Sheet>
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
