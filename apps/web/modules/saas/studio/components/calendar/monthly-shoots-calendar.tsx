"use client";

import type { ShootListItem } from "@repo/api/modules/studio/schemas/shoot";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { format, isSameMonth, isToday } from "date-fns";
import {
	formatShootClockTime,
	getShootCalendarTitle,
	getShootStatusAppearance,
} from "./calendar-utils";

const MAX_VISIBLE_SHOOTS = 3;

export function MonthlyShootsCalendar({
	days,
	currentMonth,
	shootsByDay,
	isLoading,
	selectedShootId,
	onShootSelect,
}: {
	days: Date[];
	currentMonth: Date;
	shootsByDay: Map<string, ShootListItem[]>;
	isLoading: boolean;
	selectedShootId: string | null;
	onShootSelect: (shoot: ShootListItem) => void;
}) {
	return (
		<div className="flex min-h-0 flex-1 flex-col bg-white">
			<div className="grid grid-cols-7 border-b border-neutral-200 bg-white">
				{days.slice(0, 7).map((day) => (
					<div
						key={day.toISOString()}
						className="border-l border-neutral-200 px-3 py-3 text-sm font-medium text-neutral-500 first:border-l-0"
					>
						{format(day, "EEE")}
					</div>
				))}
			</div>

			<div className="scrollbar-hide min-h-0 flex-1 overflow-auto">
				<div className="grid min-h-full grid-cols-7">
					{days.map((day) => {
						const dayKey = format(day, "yyyy-MM-dd");
						const shoots = shootsByDay.get(dayKey) ?? [];
						const visibleShoots = shoots.slice(
							0,
							MAX_VISIBLE_SHOOTS,
						);
						const hiddenCount =
							shoots.length - visibleShoots.length;
						const inCurrentMonth = isSameMonth(day, currentMonth);

						return (
							<div
								key={dayKey}
								className={cn(
									"flex min-h-36 flex-col border-b border-l border-neutral-200 px-3 py-2 first:border-l-0",
									!inCurrentMonth && "bg-neutral-50/70",
								)}
							>
								<div className="flex items-center justify-between">
									<div
										className={cn(
											"flex size-8 items-center justify-center rounded-full text-sm font-medium",
											isToday(day)
												? "bg-neutral-950 text-white"
												: inCurrentMonth
													? "text-neutral-900"
													: "text-neutral-400",
										)}
									>
										{format(day, "d")}
									</div>
									{shoots.length > 0 ? (
										<div className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">
											{shoots.length}
										</div>
									) : null}
								</div>

								<div className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5">
									{isLoading ? (
										<MonthCellSkeletons />
									) : visibleShoots.length > 0 ? (
										<>
											{visibleShoots.map((shoot) => (
												<MonthShootEvent
													key={shoot.id}
													shoot={shoot}
													selected={
														shoot.id ===
														selectedShootId
													}
													onClick={() =>
														onShootSelect(shoot)
													}
												/>
											))}
											{hiddenCount > 0 ? (
												<div className="px-1 text-xs font-medium text-neutral-500">
													+{hiddenCount} more
												</div>
											) : null}
										</>
									) : (
										<div className="flex flex-1 items-end pb-1 text-xs text-neutral-300">
											No shoots
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function MonthShootEvent({
	shoot,
	selected,
	onClick,
}: {
	shoot: ShootListItem;
	selected: boolean;
	onClick: () => void;
}) {
	const tone = getShootStatusAppearance(shoot.status);
	const timeLabel = shoot.startTime
		? formatShootClockTime(shoot.startTime)
		: "No time";

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"rounded-lg border px-2 py-1.5 text-left transition-colors",
				tone.cardClassName,
				selected && "ring-2 ring-neutral-950/10",
			)}
		>
			<div className="flex items-center gap-1.5">
				<span
					className={cn(
						"size-2 shrink-0 rounded-full",
						tone.dotClassName,
					)}
				/>
				<span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
					{timeLabel}
				</span>
			</div>
			<div className="mt-1 line-clamp-2 text-xs font-medium leading-4 text-neutral-900">
				{getShootCalendarTitle(shoot)}
			</div>
		</button>
	);
}

function MonthCellSkeletons() {
	return (
		<>
			<Skeleton className="h-14 rounded-lg" />
			<Skeleton className="h-12 rounded-lg" />
		</>
	);
}
