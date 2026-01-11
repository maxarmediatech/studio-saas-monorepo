"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@shared/lib/orpc-query-utils";
import { savedViewsApi, savedViewsMutations } from "@saas/studio/lib/api";
import type { SavedViewEntityType } from "../types";

interface UseSavedViewsOptions {
	entityType: SavedViewEntityType;
}

export function useSavedViews({ entityType }: UseSavedViewsOptions) {
	const queryClient = useQueryClient();

	const { data: views = [], isLoading } = useQuery(
		savedViewsApi.listOptions({ entityType }),
	);

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

	return {
		views,
		isLoading,

		createView: createMutation.mutateAsync,
		updateView: updateMutation.mutateAsync,
		deleteView: deleteMutation.mutateAsync,
		toggleFavorite: toggleFavoriteMutation.mutateAsync,

		isCreating: createMutation.isPending,
		isUpdating: updateMutation.isPending,
		isDeleting: deleteMutation.isPending,
	};
}
