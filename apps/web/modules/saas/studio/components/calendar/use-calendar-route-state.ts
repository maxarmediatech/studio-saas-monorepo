"use client";

import { isValid, parseISO } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { formatWeekParam, getWeekStart } from "./calendar-utils";

function getWeekStartFromParam(value: string | null) {
	if (!value) {
		return getWeekStart(new Date());
	}

	const parsedDate = parseISO(value);
	return isValid(parsedDate)
		? getWeekStart(parsedDate)
		: getWeekStart(new Date());
}

export function useCalendarRouteState() {
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();

	const weekStart = React.useMemo(
		() => getWeekStartFromParam(searchParams.get("week")),
		[searchParams],
	);

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

	const setWeekStart = React.useCallback(
		(date: Date) => {
			updateSearchParams((nextParams) => {
				nextParams.set("week", formatWeekParam(date));
			});
		},
		[updateSearchParams],
	);

	return {
		weekStart,
		setWeekStart,
	};
}
