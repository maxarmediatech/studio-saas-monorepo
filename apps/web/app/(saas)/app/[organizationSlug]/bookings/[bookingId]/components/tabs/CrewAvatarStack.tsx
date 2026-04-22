"use client";

import { Badge } from "@repo/ui/components/badge";
import { UserAvatar } from "@shared/components/UserAvatar";

type AssignedCrew = {
	id: string;
	name: string;
	avatarUrl?: string | null;
};

type CrewAvatarStackProps = {
	crew: AssignedCrew[];
	maxVisible?: number;
};

export function CrewAvatarStack({
	crew,
	maxVisible = 3,
}: CrewAvatarStackProps) {
	if (crew.length === 0) {
		return <span className="text-xs text-muted-foreground">No crew</span>;
	}

	const visibleCrew = crew.slice(0, maxVisible);
	const hiddenCount = crew.length - visibleCrew.length;

	return (
		<div
			className="flex items-center -space-x-1"
			title={crew.map((member) => member.name).join(", ")}
		>
			{visibleCrew.map((member) => (
				<UserAvatar
					key={member.id}
					name={member.name}
					avatarUrl={member.avatarUrl}
					className="size-6 rounded-full bg-gray-50 ring-2 ring-background"
				/>
			))}
			{hiddenCount > 0 && (
				<Badge
					variant="secondary"
					className="z-10 h-6 rounded-full px-1.5 text-[10px] ring-2 ring-background"
				>
					+{hiddenCount}
				</Badge>
			)}
		</div>
	);
}
