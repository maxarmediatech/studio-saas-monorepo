"use client";

import { useCurrentTime } from "@saas/studio/hooks/use-current-time";

interface UserGreetingProps {
	userName: string;
}

export function UserGreeting({ userName }: UserGreetingProps) {
	const { currentTime } = useCurrentTime();

	const hour = currentTime.getHours();
	const greeting =
		hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
	const emoji = hour < 12 ? "🌤️" : hour < 18 ? "🌥️" : "🌙";

	const firstName = userName.split(" ")[0] || "there";

	const weekDay = new Intl.DateTimeFormat("en-US", {
		weekday: "long",
	}).format(currentTime);

	const date = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
	}).format(currentTime);

	const timeString = new Intl.DateTimeFormat("en-US", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
	}).format(currentTime);

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
