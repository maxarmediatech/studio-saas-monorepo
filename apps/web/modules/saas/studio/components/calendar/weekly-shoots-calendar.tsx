"use client";

import type { ShootListItem } from "@repo/api/modules/studio/schemas/shoot";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { format, isToday } from "date-fns";
import * as React from "react";
import {
	formatShootClockTime,
	getShootCalendarTitle,
	getShootEndDateTime,
	getShootStartDateTime,
} from "./calendar-utils";

const TIME_AXIS_WIDTH = 64;
const HOUR_HEIGHT = 56;
const TOP_ROW_EVENT_HEIGHT = 24;
const TOP_ROW_EVENT_GAP = 2;
const MIN_TIMED_EVENT_HEIGHT = 32;

const HOURS = Array.from({ length: 24 }, (_, hour) => ({
	hour,
	label: format(new Date().setHours(hour, 0, 0, 0), "h a"),
}));

type TimedShootLayout = {
	shoot: ShootListItem;
	top: number;
	height: number;
};

export function WeeklyShootsCalendar({
	days,
	shootsByDay,
	isLoading,
	selectedShootId,
	onShootSelect,
}: {
	days: Date[];
	shootsByDay: Map<string, ShootListItem[]>;
	isLoading: boolean;
	selectedShootId: string | null;
	onShootSelect: (shoot: ShootListItem) => void;
}) {
	const { noTimeShootsByDay, timedShootsByDay, maxNoTimeRows } =
		React.useMemo(
			() => buildShootLayouts(days, shootsByDay),
			[days, shootsByDay],
		);
	const topRowHeight = isLoading
		? TOP_ROW_EVENT_HEIGHT * 2 + 12
		: Math.max(
				32,
				maxNoTimeRows * (TOP_ROW_EVENT_HEIGHT + TOP_ROW_EVENT_GAP) + 8,
			);
	const todayIndex = days.findIndex((day) => isToday(day));

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-white">
			<div
				className="grid border-b border-neutral-200 bg-white"
				style={{
					gridTemplateColumns: `${TIME_AXIS_WIDTH}px repeat(${days.length}, minmax(0, 1fr))`,
				}}
			>
				<div className="flex items-center justify-end pr-2 text-[11px] font-medium tracking-[0.08em] text-neutral-400 uppercase">
					{getTimezoneAbbreviation()}
				</div>
				{days.map((day) => (
					<div
						key={day.toISOString()}
						className="flex items-center justify-center py-2 text-sm"
					>
						<span
							className={cn(
								isToday(day)
									? "font-medium text-neutral-950"
									: "font-normal text-neutral-500",
							)}
						>
							{format(day, "EEE")}
						</span>
						<span
							className={cn(
								"ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-[6px] px-1.5 text-sm leading-none",
								isToday(day)
									? "bg-neutral-950 font-medium text-white"
									: "text-neutral-500",
							)}
						>
							{format(day, "d")}
						</span>
					</div>
				))}
			</div>

			<div
				className="grid border-b border-neutral-200 bg-white"
				style={{
					gridTemplateColumns: `${TIME_AXIS_WIDTH}px repeat(${days.length}, minmax(0, 1fr))`,
				}}
			>
				<div className="flex items-start justify-end pr-2 pt-2 text-[11px] font-medium text-neutral-400">
					No time
				</div>
				{days.map((day) => {
					const dayKey = format(day, "yyyy-MM-dd");
					const shoots = noTimeShootsByDay.get(dayKey) ?? [];

					return (
						<div
							key={dayKey}
							className={cn(
								"relative border-l border-neutral-200 px-1.5 py-1 first:border-l-0",
								isWeekend(day) && "bg-neutral-50/70",
							)}
							style={{ minHeight: topRowHeight }}
						>
							{isLoading ? (
								<TopRowSkeletons />
							) : (
								shoots.map((shoot, index) => (
									<TopRowShootEvent
										key={shoot.id}
										shoot={shoot}
										selected={shoot.id === selectedShootId}
										style={{
											top:
												index *
													(TOP_ROW_EVENT_HEIGHT +
														TOP_ROW_EVENT_GAP) +
												4,
										}}
										onClick={() => onShootSelect(shoot)}
									/>
								))
							)}
						</div>
					);
				})}
			</div>

			<div className="scrollbar-hide min-h-0 flex-1 overflow-auto">
				<div
					className="relative flex"
					style={{ height: HOURS.length * HOUR_HEIGHT }}
				>
					<div
						className="grid w-16 shrink-0"
						style={{
							gridTemplateRows: `repeat(${HOURS.length}, ${HOUR_HEIGHT}px)`,
						}}
					>
						{HOURS.map((hourSlot) => (
							<div
								key={hourSlot.hour}
								className="relative pr-2 text-right text-[11px] text-neutral-400"
							>
								{hourSlot.hour > 0 ? (
									<span className="absolute top-0 right-2 -translate-y-[55%] leading-none">
										{hourSlot.label}
									</span>
								) : null}
							</div>
						))}
					</div>

					<div className="relative flex-1">
						<div
							className="grid h-full"
							style={{
								gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
								gridTemplateRows: `repeat(${HOURS.length}, ${HOUR_HEIGHT}px)`,
							}}
						>
							{HOURS.map((hourSlot) =>
								days.map((day) => (
									<div
										key={`${day.toISOString()}-${hourSlot.hour}`}
										className={cn(
											"border-b border-l border-neutral-200",
											isWeekend(day) &&
												"bg-neutral-50/70",
										)}
									/>
								)),
							)}
						</div>

						<div
							className="pointer-events-none absolute inset-0 grid"
							style={{
								gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
							}}
						>
							{days.map((day) => {
								const dayKey = format(day, "yyyy-MM-dd");
								const shoots =
									timedShootsByDay.get(dayKey) ?? [];

								return (
									<div
										key={`${dayKey}-timed`}
										className="relative border-l border-neutral-200 first:border-l-0"
									>
										{shoots.map((timedShoot) => (
											<TimedShootEvent
												key={timedShoot.shoot.id}
												timedShoot={timedShoot}
												selected={
													timedShoot.shoot.id ===
													selectedShootId
												}
												onClick={() =>
													onShootSelect(
														timedShoot.shoot,
													)
												}
											/>
										))}
									</div>
								);
							})}
						</div>
					</div>

					{todayIndex >= 0 ? (
						<CurrentTimeIndicator
							daysCount={days.length}
							todayIndex={todayIndex}
						/>
					) : null}
				</div>
			</div>
		</div>
	);
}

function TopRowShootEvent({
	shoot,
	selected,
	style,
	onClick,
}: {
	shoot: ShootListItem;
	selected: boolean;
	style: React.CSSProperties;
	onClick: () => void;
}) {
	const tone = getShootEventTone(shoot.status);

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"absolute inset-x-1.5 h-6 overflow-hidden rounded-md border text-left text-xs font-medium transition-colors",
				"flex items-center gap-1.5 px-2",
				tone.baseClassName,
				selected && "ring-2 ring-neutral-950/10",
			)}
			style={style}
		>
			<span
				className={cn(
					"size-2 shrink-0 rounded-full",
					tone.dotClassName,
				)}
			/>
			<span className="truncate">{getShootCalendarTitle(shoot)}</span>
		</button>
	);
}

function TimedShootEvent({
	timedShoot,
	selected,
	onClick,
}: {
	timedShoot: TimedShootLayout;
	selected: boolean;
	onClick: () => void;
}) {
	const tone = getShootEventTone(timedShoot.shoot.status);

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"pointer-events-auto absolute inset-x-1.5 overflow-hidden rounded-xl border px-2.5 py-2 text-left shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-colors",
				tone.baseClassName,
				selected && "ring-2 ring-neutral-950/10",
			)}
			style={{
				top: timedShoot.top,
				height: timedShoot.height,
			}}
		>
			<div className="flex items-center gap-1.5">
				<span
					className={cn(
						"size-2 shrink-0 rounded-full",
						tone.dotClassName,
					)}
				/>
				<div className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
					{formatShootClockTime(timedShoot.shoot.startTime ?? "")}
				</div>
			</div>
			<div className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-neutral-900">
				{getShootCalendarTitle(timedShoot.shoot)}
			</div>
		</button>
	);
}

function TopRowSkeletons() {
	return (
		<>
			<Skeleton className="absolute inset-x-1.5 top-1 h-6 rounded-md" />
			<Skeleton className="absolute inset-x-1.5 top-8 h-6 rounded-md" />
		</>
	);
}

function CurrentTimeIndicator({
	daysCount,
	todayIndex,
}: {
	daysCount: number;
	todayIndex: number;
}) {
	const [currentTime] = useNow();
	const minutesSinceMidnight =
		currentTime.getHours() * 60 + currentTime.getMinutes();
	const top = (minutesSinceMidnight / (24 * 60)) * HOURS.length * HOUR_HEIGHT;

	return (
		<div
			className="pointer-events-none absolute inset-x-0 z-10"
			style={{ top }}
		>
			<div className="flex -translate-y-1/2 items-center">
				<div className="flex w-16 shrink-0 items-center justify-end pr-1">
					<span className="rounded-[6px] bg-[#e85d55] px-1.5 py-0.5 text-[11px] font-medium text-white">
						{format(currentTime, "h:mma")}
					</span>
				</div>
				<div className="flex flex-1 items-center">
					{Array.from({ length: daysCount }, (_, index) => (
						<div key={index} className="flex flex-1 items-center">
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

function useNow() {
	const [currentTime, setCurrentTime] = React.useState(() => new Date());

	React.useEffect(() => {
		const interval = window.setInterval(() => {
			setCurrentTime(new Date());
		}, 60000);

		return () => window.clearInterval(interval);
	}, []);

	return [currentTime] as const;
}

function buildShootLayouts(
	days: Date[],
	shootsByDay: Map<string, ShootListItem[]>,
) {
	const noTimeShootsByDay = new Map<string, ShootListItem[]>();
	const timedShootsByDay = new Map<string, TimedShootLayout[]>();
	let maxNoTimeRows = 1;

	for (const day of days) {
		const dayKey = format(day, "yyyy-MM-dd");
		const dayShoots = shootsByDay.get(dayKey) ?? [];
		const noTimeShoots: ShootListItem[] = [];
		const timedShoots: TimedShootLayout[] = [];

		for (const shoot of dayShoots) {
			const timedShoot = buildTimedShootLayout(shoot);
			if (timedShoot) {
				timedShoots.push(timedShoot);
				continue;
			}

			noTimeShoots.push(shoot);
		}

		noTimeShootsByDay.set(dayKey, noTimeShoots);
		timedShootsByDay.set(
			dayKey,
			timedShoots.sort((a, b) => a.top - b.top),
		);
		maxNoTimeRows = Math.max(maxNoTimeRows, noTimeShoots.length);
	}

	return {
		noTimeShootsByDay,
		timedShootsByDay,
		maxNoTimeRows,
	};
}

function buildTimedShootLayout(shoot: ShootListItem): TimedShootLayout | null {
	const start = getShootStartDateTime(shoot);
	const end = getShootEndDateTime(shoot);
	if (!start || !end) {
		return null;
	}

	const startMinutes = start.getHours() * 60 + start.getMinutes();
	const endMinutes =
		end.getDate() !== start.getDate() ||
		end.getMonth() !== start.getMonth() ||
		end.getFullYear() !== start.getFullYear()
			? 24 * 60
			: Math.min(24 * 60, end.getHours() * 60 + end.getMinutes());
	const durationMinutes = Math.max(30, endMinutes - startMinutes);

	return {
		shoot,
		top: (startMinutes / 60) * HOUR_HEIGHT,
		height: Math.max(
			MIN_TIMED_EVENT_HEIGHT,
			(durationMinutes / 60) * HOUR_HEIGHT,
		),
	};
}

function getTimezoneAbbreviation() {
	const match = new Date()
		.toLocaleTimeString("en-US", {
			timeZoneName: "short",
		})
		.match(/\s([A-Z]{2,5})$/);

	return match?.[1] ?? "Local";
}

function isWeekend(day: Date) {
	return day.getDay() === 0 || day.getDay() === 6;
}

function getShootEventTone(status: string) {
	const normalizedStatus = status.toLowerCase();

	if (normalizedStatus.includes("cancel")) {
		return {
			baseClassName:
				"border-red-200 bg-red-100 text-red-800 hover:bg-red-200/80",
			dotClassName: "bg-red-500",
		};
	}

	if (normalizedStatus.includes("complete")) {
		return {
			baseClassName:
				"border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200/80",
			dotClassName: "bg-emerald-500",
		};
	}

	if (normalizedStatus.includes("progress")) {
		return {
			baseClassName:
				"border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-200/80",
			dotClassName: "bg-blue-500",
		};
	}

	if (normalizedStatus.includes("confirm")) {
		return {
			baseClassName:
				"border-violet-200 bg-violet-100 text-violet-800 hover:bg-violet-200/80",
			dotClassName: "bg-violet-500",
		};
	}

	if (normalizedStatus.includes("postpone")) {
		return {
			baseClassName:
				"border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200/80",
			dotClassName: "bg-amber-500",
		};
	}

	return {
		baseClassName:
			"border-neutral-200 bg-neutral-100 text-neutral-800 hover:bg-neutral-200/80",
		dotClassName: "bg-neutral-500",
	};
}
