"use client";

import type { ShootDetail } from "@repo/api/modules/studio/schemas/shoot";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { cn } from "@repo/ui/lib/utils";
import { shootsApi, studioQueryKeys } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	CalendarDays,
	Clock3,
	MapPin,
	StickyNote,
	Users,
	X,
} from "lucide-react";
import type { ComponentType } from "react";
import {
	formatLabel,
	getShootCalendarTitle,
	getShootLocation,
	getShootStatusAppearance,
	getShootTimeLabel,
} from "./calendar-utils";

export function ShootCalendarDetailSidebar({
	shootId,
	onClearSelection,
}: {
	shootId: string | null;
	onClearSelection: () => void;
}) {
	const { data, isLoading } = useQuery({
		...(shootId
			? shootsApi.getOptions(shootId)
			: {
					queryKey: studioQueryKeys.shoots.detail("calendar-empty"),
					queryFn: async () => null,
					enabled: false,
				}),
	});

	const isMobile = useIsMobile();
	const shoot = data?.data ?? null;
	const isDesktopSidebarOpen = Boolean(shootId) && !isMobile;
	const isMobileSheetOpen = Boolean(shootId) && isMobile;

	return (
		<>
			<aside
				className={cn(
					"hidden shrink-0 border-l border-neutral-200 bg-neutral-50 transition-[width] duration-300 md:flex",
					isDesktopSidebarOpen ? "w-96" : "w-0",
				)}
			>
				<div className="h-full w-96">
					<SidebarContent
						shoot={shoot}
						isLoading={isLoading}
						onClose={onClearSelection}
					/>
				</div>
			</aside>

			<Sheet
				open={isMobileSheetOpen}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) {
						onClearSelection();
					}
				}}
			>
				<SheetContent side="right" className="w-full sm:max-w-md">
					<SheetHeader className="border-b border-neutral-200 px-6 py-5">
						<SheetTitle>Shoot details</SheetTitle>
						<SheetDescription>
							Weekly calendar context for the selected shoot.
						</SheetDescription>
					</SheetHeader>
					<div className="min-h-0 flex-1 overflow-y-auto">
						<SidebarBody shoot={shoot} isLoading={isLoading} />
					</div>
				</SheetContent>
			</Sheet>
		</>
	);
}

function SidebarContent({
	shoot,
	isLoading,
	onClose,
}: {
	shoot: ShootDetail | null;
	isLoading: boolean;
	onClose: () => void;
}) {
	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
				<div>
					<div className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
						Shoot details
					</div>
					<div className="mt-1 text-lg font-semibold text-neutral-900">
						Context
					</div>
				</div>
				<Button variant="ghost" size="icon-sm" onClick={onClose}>
					<X className="size-4" />
				</Button>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<SidebarBody shoot={shoot} isLoading={isLoading} />
			</div>
		</div>
	);
}

function SidebarBody({
	shoot,
	isLoading,
}: {
	shoot: ShootDetail | null;
	isLoading: boolean;
}) {
	if (isLoading) {
		return (
			<div className="space-y-4 p-5">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-28 rounded-2xl" />
				<Skeleton className="h-20 rounded-2xl" />
				<Skeleton className="h-40 rounded-2xl" />
			</div>
		);
	}

	if (!shoot) {
		return (
			<div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-500">
				Select a shoot card to inspect details.
			</div>
		);
	}

	const statusAppearance = getShootStatusAppearance(shoot.status);
	const location = getShootLocation(shoot);

	return (
		<div className="space-y-5 p-5">
			<div className="rounded-3xl border border-neutral-200 bg-white p-5">
				<div
					className={cn(
						"inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
						statusAppearance.chipClassName,
					)}
				>
					<span
						className={cn(
							"size-1.5 rounded-full",
							statusAppearance.dotClassName,
						)}
					/>
					{formatLabel(shoot.status)}
				</div>
				<div className="mt-4 text-xl font-semibold leading-7 text-neutral-900">
					{getShootCalendarTitle({
						bookingName: shoot.booking.name,
						shootType: shoot.shootType,
						name: shoot.name,
					})}
				</div>
				<div className="mt-2 text-sm text-neutral-500">
					{shoot.booking.referenceNumber}
				</div>
			</div>

			<div className="rounded-3xl border border-neutral-200 bg-white p-5">
				<div className="space-y-4">
					<DetailRow
						icon={CalendarDays}
						label="Date"
						value={format(
							parseISOOrDate(shoot.shootDate),
							"EEEE, MMM d",
						)}
					/>
					<DetailRow
						icon={Clock3}
						label="Time"
						value={getShootTimeLabel(shoot)}
					/>
					{location && (
						<DetailRow
							icon={MapPin}
							label="Location"
							value={location}
						/>
					)}
				</div>
			</div>

			{shoot.notes && (
				<div className="rounded-3xl border border-neutral-200 bg-white p-5">
					<div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
						<StickyNote className="size-4 text-neutral-500" />
						Notes
					</div>
					<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-600">
						{shoot.notes}
					</p>
				</div>
			)}

			<div className="rounded-3xl border border-neutral-200 bg-white p-5">
				<div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
					<Users className="size-4 text-neutral-500" />
					Crew
				</div>
				<div className="mt-3 space-y-2">
					{shoot.assignments.length === 0 ? (
						<div className="text-sm text-neutral-500">
							No crew assigned yet.
						</div>
					) : (
						shoot.assignments.map((assignment) => (
							<div
								key={assignment.id}
								className="flex items-center justify-between rounded-2xl bg-neutral-100 px-3 py-2.5"
							>
								<div>
									<div className="text-sm font-medium text-neutral-900">
										{assignment.crew.name}
									</div>
									<div className="text-xs text-neutral-500">
										{assignment.role}
									</div>
								</div>
								{assignment.isLead && (
									<Badge variant="outline">Lead</Badge>
								)}
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}

function DetailRow({
	icon: Icon,
	label,
	value,
}: {
	icon: ComponentType<{ className?: string }>;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-start gap-3">
			<div className="rounded-full bg-neutral-100 p-2">
				<Icon className="size-4 text-neutral-500" />
			</div>
			<div className="min-w-0">
				<div className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
					{label}
				</div>
				<div className="mt-1 text-sm leading-6 text-neutral-700">
					{value}
				</div>
			</div>
		</div>
	);
}

function parseISOOrDate(value: string) {
	return value.includes("T")
		? new Date(value)
		: new Date(`${value}T00:00:00`);
}
