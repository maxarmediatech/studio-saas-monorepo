"use client";

import { savedViewsApi, savedViewsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { getSystemViews } from "../system-views";
import type { SavedView, SavedViewEntityType } from "../types";

interface UseSavedViewsOptions {
	entityType: SavedViewEntityType;
}

export function useSavedViews({ entityType }: UseSavedViewsOptions) {
	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery(
		savedViewsApi.listOptions({ entityType }),
	);

	const userViews = data?.data ?? [];

	const views = useMemo((): SavedView[] => {
		const systemViewDefs = getSystemViews(entityType);

		const systemViews: SavedView[] = systemViewDefs.map((def) => ({
			id: def.id,
			organizationId: "",
			createdBy: null,
			entityType,
			name: def.name,
			description: def.description,
			icon: def.icon,
			color: null,
			filters: def.filters,
			displayFilters: null,
			columnVisibility: null,
			sorting: null,
			isSystem: true,
			isDefault: def.isDefault ?? false,
			isPublic: true,
			sortOrder: def.sortOrder,
			createdAt: "",
			updatedAt: "",
			isFavorite: false,
			createdByUser: null,
		}));

		return [...systemViews, ...userViews];
	}, [entityType, userViews]);

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
		userViews,
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
