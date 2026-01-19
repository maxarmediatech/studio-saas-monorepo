"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { useOrganizationTeamsQuery } from "@saas/organizations/lib/api";
import { useMemo } from "react";

const NO_TEAM_VALUE = "__no_team__";

export function OrganizationTeamSelect({
	organizationId,
	value,
	onSelect,
	disabled,
}: {
	organizationId: string;
	value: string | null | undefined;
	onSelect: (value: string | null) => void;
	disabled?: boolean;
}) {
	const { data: teams, isLoading } = useOrganizationTeamsQuery(organizationId, {
		enabled: Boolean(organizationId),
	});

	const options = useMemo(
		() =>
			(teams ?? []).map((team) => ({
				value: team.id,
				label: team.name,
			})),
		[teams],
	);

	if (isLoading) {
		return <Skeleton className="h-10 w-36" />;
	}

	return (
		<Select
			value={value ?? NO_TEAM_VALUE}
			onValueChange={(nextValue) =>
				onSelect(nextValue === NO_TEAM_VALUE ? null : nextValue)
			}
			disabled={disabled}
		>
			<SelectTrigger className="w-[200px]">
				<SelectValue placeholder="No team" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={NO_TEAM_VALUE}>No team</SelectItem>
				{options.map((team) => (
					<SelectItem key={team.value} value={team.value}>
						{team.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
