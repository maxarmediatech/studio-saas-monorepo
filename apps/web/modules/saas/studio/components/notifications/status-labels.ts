"use client";

import { configurationsApi } from "@saas/studio/lib/api";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import type { NotificationStatusLabelMaps } from "./content";

export function useNotificationStatusLabelMaps() {
	const [taskStatusQuery, deliverableStatusQuery, shootStatusQuery] =
		useQueries({
			queries: [
				configurationsApi.taskStatusOptions(),
				configurationsApi.deliverableStatusOptions(),
				configurationsApi.shootStatusOptions(),
			],
		});

	return useMemo<NotificationStatusLabelMaps>(() => {
		const taskStatusLabels: Record<string, string> = {};
		const deliverableStatusLabels: Record<string, string> = {};
		const shootStatusLabels: Record<string, string> = {};

		for (const config of taskStatusQuery.data?.data ?? []) {
			taskStatusLabels[config.key] = config.label;
		}

		for (const config of deliverableStatusQuery.data?.data ?? []) {
			deliverableStatusLabels[config.key] = config.label;
		}

		for (const config of shootStatusQuery.data?.data ?? []) {
			shootStatusLabels[config.key] = config.label;
		}

		return {
			task_status: taskStatusLabels,
			deliverable_status: deliverableStatusLabels,
			shoot_status: shootStatusLabels,
		};
	}, [
		deliverableStatusQuery.data?.data,
		shootStatusQuery.data?.data,
		taskStatusQuery.data?.data,
	]);
}
