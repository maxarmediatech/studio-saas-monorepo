"use client";

import { isValid, parseISO } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { formatCalendarDate, getWeekStart } from "./calendar-utils";

export type CalendarView = "week" | "month";

function getFocusDateFromParams(searchParams: URLSearchParams) {
	const rawValue = searchParams.get("date") ?? searchParams.get("week");
	if (!rawValue) {
		return new Date();
	}

	const parsedDate = parseISO(rawValue);
	return isValid(parsedDate) ? parsedDate : new Date();
}

function getViewFromParams(searchParams: URLSearchParams): CalendarView {
	return searchParams.get("view") === "month" ? "month" : "week";
}

export function useCalendarRouteState() {
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();

	const focusDate = React.useMemo(
		() => getFocusDateFromParams(searchParams),
		[searchParams],
	);
	const view = React.useMemo(
		() => getViewFromParams(searchParams),
		[searchParams],
	);
	const weekStart = React.useMemo(() => getWeekStart(focusDate), [focusDate]);

	const updateSearchParams = React.useCallback(
		(mutator: (nextParams: URLSearchParams) => void) => {
			const nextParams = new URLSearchParams(searchParams.toString());
			mutator(nextParams);

			const nextSearch = nextParams.toString();
			React.startTransition(() => {
				router.replace(
					nextSearch.length > 0
						? `${pathname}?${nextSearch}`
						: pathname,
					{ scroll: false },
				);
			});
		},
		[pathname, router, searchParams],
	);

	const setFocusDate = React.useCallback(
		(date: Date) => {
			updateSearchParams((nextParams) => {
				nextParams.set("date", formatCalendarDate(date));
				nextParams.delete("week");
			});
		},
		[updateSearchParams],
	);

	const setWeekStart = React.useCallback(
		(date: Date) => {
			setFocusDate(getWeekStart(date));
		},
		[setFocusDate],
	);

	const setView = React.useCallback(
		(nextView: CalendarView) => {
			updateSearchParams((nextParams) => {
				if (nextView === "week") {
					nextParams.delete("view");
					return;
				}

				nextParams.set("view", nextView);
			});
		},
		[updateSearchParams],
	);

	return {
		focusDate,
		view,
		weekStart,
		setFocusDate,
		setView,
		setWeekStart,
	};
}
