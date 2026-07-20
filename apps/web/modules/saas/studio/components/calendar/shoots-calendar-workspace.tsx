"use client";

import type { ShootListItem } from "@repo/api/modules/studio/schemas/shoot";
import { Button } from "@repo/ui/components/button";
import { useSession } from "@saas/auth/hooks/use-session";
import { shootsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
	addMonths,
	addWeeks,
	format,
	getWeek,
	subMonths,
	subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import {
	CALENDAR_PAGE_LIMIT,
	CALENDAR_WEEK_STARTS_ON,
	formatCalendarDate,
	getMonthGridDays,
	getMonthGridEnd,
	getMonthGridStart,
	getWeekDays,
	getWeekEnd,
	groupShootsByDay,
} from "./calendar-utils";
import { MonthlyShootsCalendar } from "./monthly-shoots-calendar";
import { ShootCalendarDetailSidebar } from "./shoot-calendar-detail-sidebar";
import { useCalendarRouteState } from "./use-calendar-route-state";
import { WeeklyShootsCalendar } from "./weekly-shoots-calendar";

export function ShootsCalendarWorkspace({ timeZone }: { timeZone: string }) {
	const { user } = useSession();
	const calendarTimeZone = user?.timezone ?? timeZone;
	const { focusDate, setFocusDate, setView, setWeekStart, view, weekStart } =
		useCalendarRouteState();
	const weekEnd = getWeekEnd(weekStart);
	const weekDays = React.useMemo(() => getWeekDays(weekStart), [weekStart]);
	const monthGridDays = React.useMemo(
		() => getMonthGridDays(focusDate),
		[focusDate],
	);
	const monthGridStart = React.useMemo(
		() => getMonthGridStart(focusDate),
		[focusDate],
	);
	const monthGridEnd = React.useMemo(
		() => getMonthGridEnd(focusDate),
		[focusDate],
	);
	const weekNumber = React.useMemo(
		() => getWeek(weekStart, { weekStartsOn: CALENDAR_WEEK_STARTS_ON }),
		[weekStart],
	);
	const [selectedShootId, setSelectedShootId] = React.useState<string | null>(
		null,
	);
	const visibleDays = view === "month" ? monthGridDays : weekDays;
	const rangeStart = view === "month" ? monthGridStart : weekStart;
	const rangeEnd = view === "month" ? monthGridEnd : weekEnd;

	const { data, isLoading } = useQuery(
		shootsApi.listOptions({
			dateFrom: formatCalendarDate(rangeStart),
			dateTo: formatCalendarDate(rangeEnd),
			page: 1,
			limit: CALENDAR_PAGE_LIMIT,
			sortBy: "shootDate",
			sortDirection: "asc",
		}),
	);

	const shoots = data?.data ?? [];
	const shootsByDay = React.useMemo(
		() => groupShootsByDay(shoots, visibleDays),
		[shoots, visibleDays],
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
	}, []);

	const handleGoToToday = React.useCallback(() => {
		setFocusDate(new Date());
	}, [setFocusDate]);

	const handleGoToPrevious = React.useCallback(() => {
		if (view === "month") {
			setFocusDate(subMonths(focusDate, 1));
			return;
		}

		setWeekStart(subWeeks(weekStart, 1));
	}, [focusDate, setFocusDate, setWeekStart, view, weekStart]);

	const handleGoToNext = React.useCallback(() => {
		if (view === "month") {
			setFocusDate(addMonths(focusDate, 1));
			return;
		}

		setWeekStart(addWeeks(weekStart, 1));
	}, [focusDate, setFocusDate, setWeekStart, view, weekStart]);

	return (
		<div className="flex min-h-0 flex-1 overflow-hidden bg-[#f8f8f7]">
			<div className="flex min-h-0 flex-1 flex-col">
				<header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-neutral-200 bg-white">
					<div className="flex min-w-0 flex-1 items-center gap-3 px-4">
						<h1 className="truncate text-xl text-neutral-950">
							<span className="font-extrabold">
								{format(focusDate, "MMMM")}
							</span>{" "}
							<span className="font-extrabold">
								{format(focusDate, "yyyy")}
							</span>{" "}
							{view === "week" ? (
								<span className="text-xs font-medium text-neutral-500">
									Week {weekNumber}
								</span>
							) : null}
						</h1>
					</div>

					<div className="flex items-center gap-2 px-4">
						<div className="flex items-center rounded-lg bg-neutral-100 p-1">
							<ViewToggleButton
								active={view === "week"}
								onClick={() => setView("week")}
							>
								Week
							</ViewToggleButton>
							<ViewToggleButton
								active={view === "month"}
								onClick={() => setView("month")}
							>
								Month
							</ViewToggleButton>
						</div>
						<Button
							variant="secondary"
							size="sm"
							className="px-3"
							onClick={handleGoToToday}
						>
							Today
						</Button>
						<div className="flex items-center">
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={handleGoToPrevious}
							>
								<ChevronLeft className="size-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={handleGoToNext}
							>
								<ChevronRight className="size-4" />
							</Button>
						</div>
					</div>
				</header>

				<div className="flex min-h-0 flex-1 overflow-hidden">
					<div className="flex min-h-0 flex-1 flex-col bg-white">
						{view === "month" ? (
							<MonthlyShootsCalendar
								days={monthGridDays}
								currentMonth={focusDate}
								shootsByDay={shootsByDay}
								isLoading={isLoading}
								selectedShootId={selectedShootId}
								onShootSelect={handleShootSelect}
							/>
						) : (
							<WeeklyShootsCalendar
								days={weekDays}
								shootsByDay={shootsByDay}
								isLoading={isLoading}
								selectedShootId={selectedShootId}
								timeZone={calendarTimeZone}
								onShootSelect={handleShootSelect}
							/>
						)}
					</div>

					<ShootCalendarDetailSidebar
						shootId={selectedShootId}
						onClearSelection={() => setSelectedShootId(null)}
					/>
				</div>
			</div>
		</div>
	);
}

function ViewToggleButton({
	active,
	children,
	onClick,
}: {
	active: boolean;
	children: React.ReactNode;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={
				active
					? "rounded-md bg-white px-3 py-1.5 text-sm font-medium text-neutral-950 shadow-sm"
					: "rounded-md px-3 py-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
			}
		>
			{children}
		</button>
	);
}
