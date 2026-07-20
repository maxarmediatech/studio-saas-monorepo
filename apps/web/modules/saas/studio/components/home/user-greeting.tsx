"use client";

import { useCurrentTime } from "@saas/studio/hooks/use-current-time";

interface UserGreetingProps {
	timeZone: string;
	userName: string;
}

export function UserGreeting({ timeZone, userName }: UserGreetingProps) {
	const { currentTime } = useCurrentTime();
	const firstName = userName.split(" ")[0] || "there";

	if (!currentTime) {
		return (
			<div
				aria-hidden="true"
				className="invisible my-5 flex flex-col items-start text-left sm:my-6 sm:items-center sm:text-center"
			>
				<h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
					Good morning, {firstName}
				</h2>
				<p className="mt-1 font-medium text-muted-foreground">
					Monday, Jan 1 00:00
				</p>
			</div>
		);
	}

	const hour = Number(
		currentTime.toLocaleString("en-US", {
			hour: "numeric",
			hourCycle: "h23",
			timeZone,
		}),
	);
	const greeting =
		hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
	const emoji = hour < 12 ? "🌤️" : hour < 18 ? "🌥️" : "🌙";

	const weekDay = currentTime.toLocaleString("en-US", {
		timeZone,
		weekday: "long",
	});
	const date = currentTime.toLocaleString("en-US", {
		day: "numeric",
		month: "short",
		timeZone,
	});
	const timeString = currentTime.toLocaleTimeString("en-US", {
		hour: "2-digit",
		hourCycle: "h23",
		minute: "2-digit",
		timeZone,
	});

	return (
		<div className="my-5 flex flex-col items-start text-left sm:my-6 sm:items-center sm:text-center">
			<h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
				Good {greeting}, {firstName}
			</h2>
			<p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-muted-foreground">
				<span>{emoji}</span>
				<span>
					{weekDay}, {date} {timeString}
				</span>
			</p>
		</div>
	);
}
