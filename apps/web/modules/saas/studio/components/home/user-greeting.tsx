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
		<div className="flex flex-col items-center my-6">
			<h2 className="text-xl font-semibold text-center">
				Good {greeting}, {firstName}
			</h2>
			<p className="flex items-center gap-2 font-medium text-muted-foreground">
				<span>{emoji}</span>
				<span>
					{weekDay}, {date} {timeString}
				</span>
			</p>
		</div>
	);
}
