"use client";

import type { ShootListItem } from "@repo/api/modules/studio/schemas/shoot";
import { Button } from "@repo/ui/components/button";
import { shootsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { addWeeks, format, getWeek, subWeeks } from "date-fns";
import {
	ChevronLeft,
	ChevronRight,
	PanelRightClose,
	PanelRightOpen,
} from "lucide-react";
import * as React from "react";
import {
	CALENDAR_PAGE_LIMIT,
	CALENDAR_WEEK_STARTS_ON,
	formatCalendarDate,
	getWeekDays,
	getWeekEnd,
	groupShootsByDay,
} from "./calendar-utils";
import { ShootCalendarDetailSidebar } from "./shoot-calendar-detail-sidebar";
import { useCalendarRouteState } from "./use-calendar-route-state";
import { WeeklyShootsCalendar } from "./weekly-shoots-calendar";

export function ShootsCalendarWorkspace() {
	const { weekStart, setWeekStart } = useCalendarRouteState();
	const weekEnd = getWeekEnd(weekStart);
	const weekDays = React.useMemo(() => getWeekDays(weekStart), [weekStart]);
	const weekNumber = React.useMemo(
		() => getWeek(weekStart, { weekStartsOn: CALENDAR_WEEK_STARTS_ON }),
		[weekStart],
	);
	const [selectedShootId, setSelectedShootId] = React.useState<string | null>(
		null,
	);
	const [isDetailOpen, setIsDetailOpen] = React.useState(true);

	const { data, isLoading } = useQuery(
		shootsApi.listOptions({
			dateFrom: formatCalendarDate(weekStart),
			dateTo: formatCalendarDate(weekEnd),
			page: 1,
			limit: CALENDAR_PAGE_LIMIT,
			sortBy: "shootDate",
			sortDirection: "asc",
		}),
	);

	const shoots = data?.data ?? [];
	const shootsByDay = React.useMemo(
		() => groupShootsByDay(shoots, weekDays),
		[shoots, weekDays],
	);

	React.useEffect(() => {
		if (!selectedShootId) {
			return;
		}

		const stillVisible = shoots.some(
			(shoot) => shoot.id === selectedShootId,
		);
		if (!stillVisible) {
			setSelectedShootId(null);
		}
	}, [selectedShootId, shoots]);

	const handleShootSelect = React.useCallback((shoot: ShootListItem) => {
		setSelectedShootId(shoot.id);
		setIsDetailOpen(true);
	}, []);

	return (
		<div className="flex min-h-0 flex-1 overflow-hidden bg-[#f8f8f7]">
			<div className="flex min-h-0 flex-1 flex-col">
				<header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-neutral-200 bg-white">
					<div className="flex min-w-0 flex-1 items-center gap-3 px-4">
						<h1 className="truncate text-xl text-neutral-950">
							<span className="font-extrabold">
								{format(weekStart, "MMMM")}
							</span>{" "}
							<span className="font-extrabold">
								{format(weekStart, "yyyy")}
							</span>{" "}
							<span className="text-xs font-medium text-neutral-500">
								Week {weekNumber}
							</span>
						</h1>
					</div>

					<div className="flex items-center gap-1 px-4">
						<Button
							variant="secondary"
							size="sm"
							className="px-3"
							onClick={() => setWeekStart(new Date())}
						>
							Today
						</Button>
						<div className="flex items-center">
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() =>
									setWeekStart(subWeeks(weekStart, 1))
								}
							>
								<ChevronLeft className="size-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() =>
									setWeekStart(addWeeks(weekStart, 1))
								}
							>
								<ChevronRight className="size-4" />
							</Button>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setIsDetailOpen((open) => !open)}
							disabled={!selectedShootId}
							className="gap-2"
						>
							{isDetailOpen ? (
								<PanelRightClose className="size-4" />
							) : (
								<PanelRightOpen className="size-4" />
							)}
							Details
						</Button>
					</div>
				</header>

				<div className="flex min-h-0 flex-1 overflow-hidden">
					<div className="flex min-h-0 flex-1 flex-col bg-white">
						<WeeklyShootsCalendar
							days={weekDays}
							shootsByDay={shootsByDay}
							isLoading={isLoading}
							selectedShootId={selectedShootId}
							onShootSelect={handleShootSelect}
						/>
					</div>

					<ShootCalendarDetailSidebar
						shootId={selectedShootId}
						open={isDetailOpen}
						onOpenChange={setIsDetailOpen}
					/>
				</div>
			</div>
		</div>
	);
}
