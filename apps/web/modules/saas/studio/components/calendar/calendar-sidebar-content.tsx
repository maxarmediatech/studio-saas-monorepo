"use client";

import { Calendar } from "@repo/ui/components/calendar";
import { shootsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format, isSameDay } from "date-fns";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import * as React from "react";
import type { NavAreaConfig } from "../../lib/navigation/types";
import {
	CALENDAR_PAGE_LIMIT,
	formatCalendarDate,
	getMonthEnd,
	getMonthStart,
	getWeekDays,
	getWeekEnd,
} from "./calendar-utils";
import { useCalendarRouteState } from "./use-calendar-route-state";

export function CalendarWorkspaceSidebarContent({
	area,
}: {
	area: NavAreaConfig;
}) {
	const { focusDate, setFocusDate, view, weekStart } =
		useCalendarRouteState();
	const weekEnd = getWeekEnd(weekStart);
	const monthStart = getMonthStart(focusDate);
	const monthEnd = getMonthEnd(focusDate);
	const visibleDays = React.useMemo(
		() => (view === "week" ? getWeekDays(weekStart) : []),
		[view, weekStart],
	);
	const [displayedMonth, setDisplayedMonth] = React.useState(focusDate);
	const modifiers = React.useMemo(
		() =>
			view === "week"
				? {
						inView: (date: Date) =>
							visibleDays.some((day) => isSameDay(day, date)),
					}
				: undefined,
		[view, visibleDays],
	);

	React.useEffect(() => {
		setDisplayedMonth((currentMonth) => {
			if (
				currentMonth.getFullYear() === focusDate.getFullYear() &&
				currentMonth.getMonth() === focusDate.getMonth()
			) {
				return currentMonth;
			}

			return focusDate;
		});
	}, [focusDate]);

	const { data, isLoading } = useQuery(
		shootsApi.listOptions({
			dateFrom: formatCalendarDate(
				view === "week" ? weekStart : monthStart,
			),
			dateTo: formatCalendarDate(view === "week" ? weekEnd : monthEnd),
			page: 1,
			limit: CALENDAR_PAGE_LIMIT,
			sortBy: "shootDate",
			sortDirection: "asc",
		}),
	);

	const shoots = data?.data ?? [];
	const bookedDaysCount = new Set(shoots.map((shoot) => shoot.shootDate))
		.size;

	return (
		<div className="flex h-full flex-col">
			<div className="px-3 pb-3 pt-3">
				{area.backHref ? (
					<Link
						href={area.backHref}
						className="group flex items-center gap-3 px-2 py-2"
					>
						<div className="flex size-6 items-center justify-center rounded-lg bg-neutral-200 text-neutral-600 transition-[transform,background-color,color] duration-150 group-hover:-translate-x-0.5 group-hover:bg-neutral-300">
							<ChevronLeft className="size-3" strokeWidth={2.5} />
						</div>
						<span className="text-base font-semibold text-neutral-900">
							{area.title}
						</span>
					</Link>
				) : (
					<div className="px-2 py-2 text-base font-semibold text-neutral-900">
						{area.title}
					</div>
				)}
			</div>

			<div className="min-w-0 space-y-4 px-3 pb-4">
				<div className="min-w-0">
					<Calendar
						mode="single"
						month={displayedMonth}
						onMonthChange={setDisplayedMonth}
						selected={focusDate}
						onSelect={(date) => {
							if (date) {
								setFocusDate(date);
							}
						}}
						modifiers={modifiers}
						modifiersClassNames={
							modifiers ? { inView: "in-view-day" } : undefined
						}
						className="min-w-0 w-full bg-transparent p-0 [--cell-size:1.9rem]"
						classNames={{
							root: "w-full min-w-0 bg-transparent",
							month: "w-full gap-2",
							table: "w-full",
							weekdays: "flex w-full",
							week: "mt-2 flex w-full",
							weekday: "flex-1 text-center text-[11px]",
							month_caption:
								"flex h-8 w-full items-center justify-center px-8",
							button_previous:
								"size-8 rounded-md p-0 text-neutral-700",
							button_next:
								"size-8 rounded-md p-0 text-neutral-700",
						}}
					/>
				</div>

				<div className="space-y-3 px-1">
					<div className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
						{view === "week" ? "Week" : "Month"}
					</div>
					<div className="text-lg font-semibold text-neutral-900">
						{view === "week"
							? `${format(weekStart, "MMM d")} to ${format(weekEnd, "MMM d")}`
							: format(focusDate, "MMMM yyyy")}
					</div>
					<div className="text-sm text-neutral-500">
						{view === "week"
							? format(weekStart, "yyyy")
							: `${format(monthStart, "MMM d")} to ${format(monthEnd, "MMM d")}`}
					</div>
					<div className="flex flex-wrap gap-2">
						<MetaPill>
							{isLoading
								? "Loading shoots..."
								: `${shoots.length} shoots`}
						</MetaPill>
						<MetaPill>{bookedDaysCount} active days</MetaPill>
					</div>
				</div>
			</div>
		</div>
	);
}

function MetaPill({ children }: { children: ReactNode }) {
	return (
		<div className="rounded-full bg-black/[0.05] px-3 py-1.5 text-xs font-medium text-neutral-700">
			{children}
		</div>
	);
}
