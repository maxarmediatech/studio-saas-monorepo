"use client";

import { savedViewsApi, savedViewsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { SavedViewEntityType } from "../types";

interface UseSavedViewsOptions {
	entityType: SavedViewEntityType;
}

export function useSavedViews({ entityType }: UseSavedViewsOptions) {
	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery(
		savedViewsApi.listOptions({ entityType }),
	);

	const views = data?.data ?? [];

	const invalidateViews = () => {
		queryClient.invalidateQueries({ queryKey: orpc.savedViews.key() });
	};

	const createMutation = useMutation({
		...savedViewsMutations.create(),
		onSuccess: invalidateViews,
	});

	const updateMutation = useMutation({
		...savedViewsMutations.update(),
		onSuccess: invalidateViews,
	});

	const deleteMutation = useMutation({
		...savedViewsMutations.delete(),
		onSuccess: invalidateViews,
	});

	const toggleFavoriteMutation = useMutation({
		...savedViewsMutations.toggleFavorite(),
		onSuccess: invalidateViews,
	});

	const toggleFavorite = useCallback(
		(viewId: string) => {
			toggleFavoriteMutation.mutate({ viewId });
		},
		[toggleFavoriteMutation],
	);

	return {
		views,
		isLoading,

		createView: createMutation.mutateAsync,
		updateView: updateMutation.mutateAsync,
		deleteView: deleteMutation.mutateAsync,
		toggleFavorite,

		isCreating: createMutation.isPending,
		isUpdating: updateMutation.isPending,
		isDeleting: deleteMutation.isPending,
	};
}
