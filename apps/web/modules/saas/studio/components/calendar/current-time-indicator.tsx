"use client";

import { useCurrentTime } from "@saas/studio/hooks/use-current-time";
import {
	getCalendarDateKey,
	getMinutesSinceMidnight,
} from "./calendar-timezone";

type CurrentTimeIndicatorProps = {
	dayKeys: string[];
	timelineHeight: number;
	timeZone: string;
};

export function CurrentTimeIndicator({
	dayKeys,
	timelineHeight,
	timeZone,
}: CurrentTimeIndicatorProps) {
	const { currentTime } = useCurrentTime();

	if (!currentTime) {
		return null;
	}
	const todayKey = getCalendarDateKey(currentTime, timeZone);
	const todayIndex = todayKey ? dayKeys.indexOf(todayKey) : -1;
	if (todayIndex < 0) {
		return null;
	}
	const minutesSinceMidnight = getMinutesSinceMidnight(currentTime, timeZone);
	const top = (minutesSinceMidnight / (24 * 60)) * timelineHeight;

	return (
		<div
			className="pointer-events-none absolute inset-x-0 z-10"
			style={{ top }}
		>
			<div className="flex -translate-y-1/2 items-center">
				<div className="flex w-16 shrink-0 items-center justify-end pr-1">
					<span className="rounded-[6px] bg-[#e85d55] px-1.5 py-0.5 text-[11px] font-medium text-white">
						{currentTime
							.toLocaleTimeString("en-US", {
								hour: "numeric",
								hour12: true,
								minute: "2-digit",
								timeZone,
							})
							.replace(" ", "")}
					</span>
				</div>
				<div className="flex flex-1 items-center">
					{dayKeys.map((dayKey, index) => (
						<div key={dayKey} className="flex flex-1 items-center">
							{index === todayIndex ? (
								<>
									<div className="h-3 w-[3px] rounded-full bg-[#e85d55]" />
									<div className="h-[3px] flex-1 rounded-r-full bg-[#e85d55]" />
								</>
							) : (
								<div className="h-px flex-1 bg-[#e85d55]/55" />
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
