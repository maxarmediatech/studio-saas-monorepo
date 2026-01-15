"use client";

import type { YourWorkView } from "@repo/api/modules/studio/schemas/your-work";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { yourWorkApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { YourWorkTable } from "./your-work-table";

interface YourWorkViewProps {
	organizationSlug: string;
	initialFilters: {
		view: YourWorkView;
		entityType: "all" | "task" | "deliverable" | "shoot";
		page: number;
	};
}

export function YourWorkView({
	organizationSlug,
	initialFilters,
}: YourWorkViewProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [filters, setFilters] = useState(initialFilters);

	const queryInput = useMemo(
		() => ({
			view: filters.view,
			entityType: filters.entityType,
			page: filters.page,
			limit: 10,
		}),
		[filters],
	);

	const { data, isLoading, isFetching } = useQuery(
		yourWorkApi.listOptions(queryInput),
	);

	const pagination = data?.pagination ?? {
		page: filters.page,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	const updateFilters = (
		updates: Partial<YourWorkViewProps["initialFilters"]>,
	) => {
		const nextFilters = { ...filters, ...updates };
		setFilters(nextFilters);

		const params = new URLSearchParams();
		if (nextFilters.view !== "assigned") {
			params.set("view", nextFilters.view);
		}
		if (nextFilters.entityType !== "all") {
			params.set("entityType", nextFilters.entityType);
		}
		if (nextFilters.page > 1) {
			params.set("page", String(nextFilters.page));
		}

		const queryString = params.toString();
		const url = `/app/${organizationSlug}/your-work${queryString ? `?${queryString}` : ""}`;

		startTransition(() => {
			router.push(url, { scroll: false });
		});
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Tabs
					value={filters.view}
					onValueChange={(value) =>
						updateFilters({
							view: value as YourWorkView,
							page: 1,
						})
					}
					className="w-full md:w-auto"
				>
					<TabsList>
						<TabsTrigger value="assigned">Assigned</TabsTrigger>
						<TabsTrigger value="created">Created</TabsTrigger>
						<TabsTrigger value="subscribed">Watching</TabsTrigger>
					</TabsList>
				</Tabs>

				<Select
					value={filters.entityType}
					onValueChange={(value) =>
						updateFilters({
							entityType: value as YourWorkViewProps["initialFilters"]["entityType"],
							page: 1,
						})
					}
				>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="All types" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All types</SelectItem>
						<SelectItem value="task">Tasks</SelectItem>
						<SelectItem value="deliverable">Deliverables</SelectItem>
						<SelectItem value="shoot">Shoots</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<YourWorkTable
				organizationSlug={organizationSlug}
				data={data?.data ?? []}
				isLoading={isLoading}
				isFetching={isFetching || isPending}
				pagination={pagination}
				onPaginationChange={(next) =>
					updateFilters({ page: next.page })
				}
			/>
		</div>
	);
}
