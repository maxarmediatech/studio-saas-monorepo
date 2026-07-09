"use client";

import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";

const CREW_OPTIONS_PAGE_SIZE = 100;

export interface CrewOptionRecord {
	id: string;
	name: string;
	phoneNumber?: string | null;
	email?: string | null;
	dailyRate?: string | null;
}

export function useAllCrewOptions(enabled = true) {
	return useQuery({
		queryKey: [...orpc.crews.key(), "all-options"],
		enabled,
		queryFn: async () => {
			const allCrews: CrewOptionRecord[] = [];
			let page = 1;
			let pageCount = 1;

			while (page <= pageCount) {
				const response = await orpcClient.crews.list({
					page,
					limit: CREW_OPTIONS_PAGE_SIZE,
					sortBy: "name",
					sortDirection: "asc",
					includeDeleted: false,
				});

				allCrews.push(
					...response.data.map((crew) => ({
						id: crew.id,
						name: crew.name,
						phoneNumber: crew.phoneNumber,
						email: crew.email,
						dailyRate: crew.dailyRate,
					})),
				);

				pageCount = response.pagination.pageCount;
				page += 1;
			}

			return Array.from(
				new Map(allCrews.map((crew) => [crew.id, crew])).values(),
			);
		},
	});
}
