"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import { stickiesApi, stickiesMutations } from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, StickyNoteIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { getRandomStickyColor, type StickyColor } from "./constants";
import { StickiesMasonry, StickiesMasonryItem } from "./stickies-masonry";
import { type StickyData, StickyNote } from "./sticky-note";

interface Sticky {
	id: string;
	organizationId: string;
	userId: string;
	title: string | null;
	content: string | null;
	descriptionHtml: string | null;
	color: StickyColor;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

interface StickiesResponse {
	data: Sticky[];
}

export function StickiesWidget() {
	const [focusStickyId, setFocusStickyId] = useState<string | null>(null);

	const listQueryOptions = stickiesApi.listOptions();
	const LIST_QUERY_KEY = listQueryOptions.queryKey;
	const { data, isLoading } = useQuery({
		...listQueryOptions,
		staleTime: Number.POSITIVE_INFINITY,
		refetchOnWindowFocus: false,
	});
	const stickies = (data as unknown as StickiesResponse)?.data ?? [];

	const queryClient = useQueryClient();

	const createMutation = useMutation({
		...stickiesMutations.create(),
		onSuccess: (response) => {
			queryClient.setQueryData(
				LIST_QUERY_KEY,
				(old: StickiesResponse | undefined) => {
					const oldData = old?.data ?? [];
					return { data: [response, ...oldData] };
				},
			);
			setFocusStickyId(response.id);
		},
		onError: () => {
			toast.error("Failed to create sticky");
		},
	});

	const updateMutation = useMutation({
		...stickiesMutations.update(),
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: LIST_QUERY_KEY });
			const previousData = queryClient.getQueryData(LIST_QUERY_KEY);

			// Also update TanStack Query cache
			queryClient.setQueryData(
				LIST_QUERY_KEY,
				(old: StickiesResponse | undefined) => {
					if (!old) {
						return old;
					}
					return {
						...old,
						data: old.data.map((s) => {
							if (s.id !== variables.id) {
								return s;
							}
							const updated = { ...s };
							if (variables.content !== undefined) {
								updated.content = variables.content ?? null;
							}
							if (variables.color !== undefined) {
								updated.color = variables.color;
							}
							return updated;
						}),
					};
				},
			);
			return { previousData };
		},
		onSuccess: (response) => {
			queryClient.setQueryData(
				LIST_QUERY_KEY,
				(old: StickiesResponse | undefined) => {
					if (!old) {
						return old;
					}
					return {
						...old,
						data: old.data.map((s) =>
							s.id === response.id ? { ...s, ...response } : s,
						),
					};
				},
			);
		},
		onError: (_err, _variables, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(LIST_QUERY_KEY, context.previousData);
			}
			toast.error("Failed to update sticky");
		},
	});

	const deleteMutation = useMutation({
		...stickiesMutations.delete(),
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: LIST_QUERY_KEY });
			const previousData = queryClient.getQueryData(LIST_QUERY_KEY);

			queryClient.setQueryData(
				LIST_QUERY_KEY,
				(old: StickiesResponse | undefined) => {
					if (!old) {
						return old;
					}
					return {
						...old,
						data: old.data.filter((s) => s.id !== variables.id),
					};
				},
			);
			return { previousData };
		},
		onSuccess: () => {
			toast.success("Sticky deleted");
		},
		onError: (_err, _variables, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(LIST_QUERY_KEY, context.previousData);
			}
			toast.error("Failed to delete sticky");
		},
	});

	const handleCreate = useCallback(() => {
		createMutation.mutate({
			content: "",
			color: getRandomStickyColor(),
		});
	}, [createMutation]);

	const handleUpdate = useCallback(
		(id: string, data: Partial<StickyData>) => {
			const payload: {
				id: string;
				content?: string;
				color?: StickyColor;
			} = { id };

			if (data.content !== undefined) {
				payload.content = data.content ?? "";
			}
			if (data.color !== undefined) {
				payload.color = data.color;
			}

			updateMutation.mutate(payload);
		},
		[updateMutation],
	);

	const handleDelete = useCallback(
		(id: string) => {
			deleteMutation.mutate({ id });
		},
		[deleteMutation],
	);

	if (isLoading) {
		return (
			<div className="py-4">
				<div className="flex items-center justify-between mb-4">
					<div className="text-sm font-semibold text-muted-foreground">
						Stickies
					</div>
					<Skeleton className="h-5 w-20 rounded" />
				</div>
				<StickiesMasonry>
					{Array.from({ length: 6 }).map((_, i) => (
						<StickiesMasonryItem key={i}>
							<Skeleton className="h-48 rounded-lg" />
						</StickiesMasonryItem>
					))}
				</StickiesMasonry>
			</div>
		);
	}

	const hasStickies = stickies.length > 0;

	return (
		<div className="py-4">
			<div className="flex items-center justify-between mb-4">
				<div className="text-sm font-semibold text-muted-foreground">
					Stickies
				</div>
				<button
					type="button"
					onClick={handleCreate}
					disabled={createMutation.isPending}
					className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
				>
					<PlusIcon className="size-4" />
					Add sticky
					{createMutation.isPending && (
						<span className="size-4 border-2 border-t-transparent border-primary rounded-full animate-spin" />
					)}
				</button>
			</div>

			{!hasStickies ? (
				<div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-xl">
					<StickyNoteIcon className="size-10 text-muted-foreground/30 mb-3" />
					<p className="text-sm text-muted-foreground">
						Jot down quick notes and reminders
					</p>
				</div>
			) : (
				<StickiesMasonry className="max-h-[600px] overflow-y-auto scrollbar-thin pr-1">
					{stickies.map((sticky) => (
						<StickiesMasonryItem key={sticky.id}>
							<StickyNote
								sticky={{
									id: sticky.id,
									content: sticky.content,
									descriptionHtml: sticky.descriptionHtml,
									color: sticky.color as StickyColor,
								}}
								autoFocus={sticky.id === focusStickyId}
								onAutoFocus={() => {
									setFocusStickyId(null);
								}}
								onUpdate={(data) =>
									handleUpdate(sticky.id, data)
								}
								onDelete={() => handleDelete(sticky.id)}
								isDeleting={
									deleteMutation.isPending &&
									deleteMutation.variables?.id === sticky.id
								}
								showToolbar
							/>
						</StickiesMasonryItem>
					))}
				</StickiesMasonry>
			)}
		</div>
	);
}
