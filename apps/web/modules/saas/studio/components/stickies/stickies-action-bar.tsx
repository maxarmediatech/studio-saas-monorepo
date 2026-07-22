"use client";

import { Button } from "@repo/ui/components/button";
import { Dialog, DialogContent, DialogTitle } from "@repo/ui/components/dialog";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@repo/ui/components/input-group";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { stickiesApi, stickiesMutations } from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ListIcon,
	PlusIcon,
	SearchIcon,
	StickyNoteIcon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useOutsideClickDetector } from "../../hooks/use-outside-click-detector";
import {
	getRandomStickyColor,
	type StickyColor,
} from "../home/widgets/stickies/constants";
import {
	type StickyData,
	StickyNote,
} from "../home/widgets/stickies/sticky-note";

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

interface StickiesActionBarProps {
	organizationSlug: string;
}

// Cache invalidation helpers (shared with home widget)
const hasStickiesKey = (value: unknown): boolean => {
	if (typeof value === "string") {
		return value.includes("stickies");
	}
	if (Array.isArray(value)) {
		return value.some(hasStickiesKey);
	}
	if (value && typeof value === "object") {
		return Object.values(value).some(hasStickiesKey);
	}
	return false;
};

const isStickiesListQuery = (queryKey: readonly unknown[]): boolean =>
	queryKey.some(hasStickiesKey);

const findLimit = (value: unknown): number | undefined => {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			const limit = findLimit(item);
			if (limit !== undefined) {
				return limit;
			}
		}
		return undefined;
	}
	const record = value as Record<string, unknown>;
	if (typeof record.limit === "number") {
		return record.limit;
	}
	if (record.input && typeof record.input === "object") {
		const input = record.input as Record<string, unknown>;
		if (typeof input.limit === "number") {
			return input.limit;
		}
	}
	return undefined;
};

const getQueryLimit = (queryKey: readonly unknown[]): number | undefined => {
	for (const part of queryKey) {
		const limit = findLimit(part);
		if (limit !== undefined) {
			return limit;
		}
	}
	return undefined;
};

const stripHtml = (value: string | null | undefined): string => {
	if (!value) {
		return "";
	}
	return value.replace(/<[^>]*>/g, " ");
};

const getStickySearchText = (sticky: Sticky): string =>
	`${sticky.title ?? ""} ${sticky.content ?? ""} ${stripHtml(
		sticky.descriptionHtml,
	)}`.toLowerCase();

const isStickyBlank = (sticky: Sticky): boolean => {
	const text = `${sticky.title ?? ""} ${sticky.content ?? ""} ${stripHtml(
		sticky.descriptionHtml,
	)}`.trim();
	return text.length === 0;
};

const isStickyDraftBlank = (sticky: StickyData | null): boolean => {
	if (!sticky) {
		return false;
	}
	const text = `${sticky.content ?? ""} ${stripHtml(
		sticky.descriptionHtml,
	)}`.trim();
	return text.length === 0;
};

interface StickiesModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreate: () => Promise<Sticky | null>;
	onUpdate: (id: string, data: Partial<StickyData>) => void;
	onDelete: (id: string) => void;
	isCreating: boolean;
	isDeleting: boolean;
	deletingId?: string;
}

function StickiesModal({
	open,
	onOpenChange,
	onCreate,
	onUpdate,
	onDelete,
	isCreating,
	isDeleting,
	deletingId,
}: StickiesModalProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [focusStickyId, setFocusStickyId] = useState<string | null>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

	const listQueryOptions = stickiesApi.listOptions();
	const { data, isLoading } = useQuery({
		...listQueryOptions,
		enabled: open,
		staleTime: 0,
		refetchOnMount: "always",
		refetchOnWindowFocus: false,
	});
	const stickies = (data as StickiesResponse | undefined)?.data ?? [];

	const normalizedQuery = searchQuery.trim().toLowerCase();
	const filteredStickies = useMemo(() => {
		if (!normalizedQuery) {
			return stickies;
		}
		return stickies.filter((sticky) =>
			getStickySearchText(sticky).includes(normalizedQuery),
		);
	}, [normalizedQuery, stickies]);

	useEffect(() => {
		if (!open) {
			setSearchQuery("");
			setFocusStickyId(null);
			setIsSearchOpen(false);
		}
	}, [open]);

	useEffect(() => {
		if (isSearchOpen) {
			searchInputRef.current?.focus();
		}
	}, [isSearchOpen]);

	const hasStickies = filteredStickies.length > 0;
	const showSearchEmptyState = normalizedQuery.length > 0 && !hasStickies;
	const hasBlankSticky = stickies.some(isStickyBlank);

	const handleCreate = useCallback(async () => {
		try {
			if (hasBlankSticky) {
				toast.error(
					"Finish the current sticky before creating another.",
				);
				return;
			}
			const created = await onCreate();
			if (created?.id) {
				setFocusStickyId(created.id);
			}
		} catch {
			// Errors are handled by the create mutation toast.
		}
	}, [hasBlankSticky, onCreate]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="w-[88vw] max-w-[88vw] sm:max-w-[88vw] h-[80vh] p-0"
			>
				<div className="flex h-full min-h-0 flex-col">
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-6 py-4">
						<div className="flex items-center gap-2">
							<StickyNoteIcon className="size-5 text-muted-foreground" />
							<DialogTitle className="text-lg font-semibold">
								Your stickies
							</DialogTitle>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{isSearchOpen ? (
								<InputGroup className="w-[220px]">
									<InputGroupAddon>
										<SearchIcon className="size-4" />
									</InputGroupAddon>
									<InputGroupInput
										ref={searchInputRef}
										placeholder="Search stickies"
										value={searchQuery}
										onChange={(event) =>
											setSearchQuery(event.target.value)
										}
										onBlur={() => {
											if (!searchQuery.trim()) {
												setIsSearchOpen(false);
											}
										}}
									/>
								</InputGroup>
							) : (
								<Button
									variant="outline"
									size="icon"
									className="h-8 w-8"
									onClick={() => setIsSearchOpen(true)}
								>
									<SearchIcon className="size-4 text-muted-foreground" />
									<span className="sr-only">
										Search stickies
									</span>
								</Button>
							)}
							<Button
								variant="ghost"
								size="sm"
								className="text-primary"
								onClick={handleCreate}
								disabled={isCreating}
							>
								<PlusIcon className="size-4" />
								Add sticky
								{isCreating && (
									<span className="ml-2 size-4 border-2 border-t-transparent border-primary rounded-full animate-spin" />
								)}
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								onClick={() => onOpenChange(false)}
							>
								<XIcon className="size-4 text-muted-foreground" />
								<span className="sr-only">Close</span>
							</Button>
						</div>
					</div>

					<ScrollArea className="flex-1 min-h-0 px-6 py-5">
						{isLoading ? (
							<div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
								{Array.from({ length: 6 }).map((_, index) => (
									<Skeleton
										key={index}
										className="h-52 rounded-lg"
									/>
								))}
							</div>
						) : hasStickies ? (
							<div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
								{filteredStickies.map((sticky) => (
									<StickyNote
										key={sticky.id}
										sticky={{
											id: sticky.id,
											content: sticky.content,
											descriptionHtml:
												sticky.descriptionHtml,
											color: sticky.color as StickyColor,
										}}
										autoFocus={sticky.id === focusStickyId}
										onAutoFocus={() => {
											setFocusStickyId(null);
										}}
										onUpdate={(data) =>
											onUpdate(sticky.id, data)
										}
										onDelete={() => onDelete(sticky.id)}
										isDeleting={
											isDeleting &&
											deletingId === sticky.id
										}
										showToolbar
									/>
								))}
							</div>
						) : (
							<div className="flex flex-col items-center justify-center rounded-xl bg-muted/30 py-12">
								<StickyNoteIcon className="mb-3 size-10 text-muted-foreground/30" />
								<p className="text-sm text-muted-foreground">
									{showSearchEmptyState
										? "No stickies match your search"
										: "Jot down quick notes and reminders"}
								</p>
							</div>
						)}
					</ScrollArea>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function StickiesActionBar({
	organizationSlug,
}: StickiesActionBarProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [showNewSticky, setShowNewSticky] = useState(false);
	const [isAllStickiesOpen, setIsAllStickiesOpen] = useState(false);
	const [newStickyData, setNewStickyData] = useState<StickyData | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const queryClient = useQueryClient();

	const showPreview = showNewSticky;

	// Close menu when clicking outside
	useOutsideClickDetector(
		containerRef,
		() => {
			setIsExpanded(false);
			setShowNewSticky(false);
		},
		isExpanded || showPreview,
	);

	// Cache update helper
	const updateStickiesCaches = useCallback(
		(
			updater: (
				old: StickiesResponse | undefined,
				limit: number | undefined,
			) => StickiesResponse | undefined,
		) => {
			const queries = queryClient.getQueryCache().findAll({
				predicate: ({ queryKey }) => isStickiesListQuery(queryKey),
			});
			for (const query of queries) {
				queryClient.setQueryData(query.queryKey, (oldData) =>
					updater(
						oldData as StickiesResponse | undefined,
						getQueryLimit(query.queryKey),
					),
				);
			}
		},
		[queryClient],
	);

	const hasBlankStickyInCache = useCallback(() => {
		const queries = queryClient.getQueryCache().findAll({
			predicate: ({ queryKey }) => isStickiesListQuery(queryKey),
		});
		return queries.some((query) => {
			const data = queryClient.getQueryData(query.queryKey) as
				| StickiesResponse
				| undefined;
			return data?.data?.some(isStickyBlank) ?? false;
		});
	}, [queryClient]);

	// Create mutation
	const createMutation = useMutation({
		...stickiesMutations.create(),
		onSuccess: (response) => {
			updateStickiesCaches((old, limit) => {
				const oldData = old?.data ?? [];
				const next = [response, ...oldData];
				const nextData =
					typeof limit === "number" ? next.slice(0, limit) : next;
				return { data: nextData };
			});
			// Update local new sticky with the created ID
			setNewStickyData({
				id: response.id,
				content: response.content,
				descriptionHtml: response.descriptionHtml,
				color: response.color as StickyColor,
			});
		},
		onError: () => {
			toast.error("Failed to create sticky");
			setShowNewSticky(false);
			setNewStickyData(null);
		},
	});

	// Update mutation
	const updateMutation = useMutation({
		...stickiesMutations.update(),
		onMutate: async (variables) => {
			const previousData: Record<string, unknown> = {};

			const queries = queryClient.getQueryCache().findAll({
				predicate: ({ queryKey }) => isStickiesListQuery(queryKey),
			});

			for (const query of queries) {
				previousData[JSON.stringify(query.queryKey)] =
					queryClient.getQueryData(query.queryKey);

				queryClient.setQueryData(
					query.queryKey,
					(old: StickiesResponse | undefined) => {
						if (!old) return old;
						return {
							...old,
							data: old.data.map((s) => {
								if (s.id !== variables.id) return s;
								const updated = { ...s };
								if (variables.content !== undefined) {
									updated.content = variables.content ?? null;
								}
								if (variables.descriptionHtml !== undefined) {
									updated.descriptionHtml =
										variables.descriptionHtml ?? null;
								}
								if (variables.color !== undefined) {
									updated.color = variables.color;
								}
								return updated;
							}),
						};
					},
				);
			}

			return { previousData };
		},
		onSuccess: (response) => {
			updateStickiesCaches((old) => {
				if (!old) return old;
				return {
					...old,
					data: old.data.map((s) =>
						s.id === response.id ? { ...s, ...response } : s,
					),
				};
			});
			// Update local state
			if (newStickyData?.id === response.id) {
				setNewStickyData({
					id: response.id,
					content: response.content,
					descriptionHtml: response.descriptionHtml,
					color: response.color as StickyColor,
				});
			}
		},
		onError: (_err, _variables, context) => {
			if (context?.previousData) {
				for (const [key, data] of Object.entries(
					context.previousData,
				)) {
					queryClient.setQueryData(JSON.parse(key), data);
				}
			}
			toast.error("Failed to update sticky");
		},
	});

	// Delete mutation
	const deleteMutation = useMutation({
		...stickiesMutations.delete(),
		onMutate: async (variables) => {
			const previousData: Record<string, unknown> = {};

			const queries = queryClient.getQueryCache().findAll({
				predicate: ({ queryKey }) => isStickiesListQuery(queryKey),
			});

			for (const query of queries) {
				previousData[JSON.stringify(query.queryKey)] =
					queryClient.getQueryData(query.queryKey);

				queryClient.setQueryData(
					query.queryKey,
					(old: StickiesResponse | undefined) => {
						if (!old) return old;
						return {
							...old,
							data: old.data.filter((s) => s.id !== variables.id),
						};
					},
				);
			}

			return { previousData };
		},
		onSuccess: (_response, variables) => {
			updateStickiesCaches((old) => {
				if (!old) return old;
				return {
					...old,
					data: old.data.filter((s) => s.id !== variables.id),
				};
			});
			toast.success("Sticky deleted");
			// Close preview if deleted sticky was being viewed
			if (newStickyData?.id === variables.id) {
				setShowNewSticky(false);
				setNewStickyData(null);
			}
		},
		onError: (_err, _variables, context) => {
			if (context?.previousData) {
				for (const [key, data] of Object.entries(
					context.previousData,
				)) {
					queryClient.setQueryData(JSON.parse(key), data);
				}
			}
			toast.error("Failed to delete sticky");
		},
	});

	const handleToggle = useCallback(() => {
		if (isExpanded) {
			setIsExpanded(false);
			setShowNewSticky(false);
		} else {
			setIsExpanded(true);
		}
	}, [isExpanded]);

	const handleOpenAllStickies = useCallback(() => {
		setIsAllStickiesOpen(true);
		setIsExpanded(false);
		setShowNewSticky(false);
	}, []);

	const handleCreateNew = useCallback(() => {
		if (
			(showNewSticky && isStickyDraftBlank(newStickyData)) ||
			hasBlankStickyInCache()
		) {
			toast.error("Finish the current sticky before creating another.");
			return;
		}

		const color = getRandomStickyColor();
		setNewStickyData({
			content: "",
			descriptionHtml: "",
			color,
		});
		setShowNewSticky(true);

		// Create the sticky in the database
		createMutation.mutate({
			content: "",
			color,
		});
	}, [createMutation, hasBlankStickyInCache, newStickyData, showNewSticky]);

	const handleCreateFromModal = useCallback(async () => {
		const color = getRandomStickyColor();

		try {
			const response = await createMutation.mutateAsync({
				content: "",
				color,
			});
			return response;
		} catch {
			return null;
		}
	}, [createMutation]);

	const handleUpdateSticky = useCallback(
		(id: string, data: Partial<StickyData>) => {
			const payload: {
				id: string;
				content?: string;
				descriptionHtml?: string;
				color?: StickyColor;
			} = { id };

			if (data.content !== undefined) {
				payload.content = data.content ?? "";
			}
			if (data.descriptionHtml !== undefined) {
				payload.descriptionHtml = data.descriptionHtml ?? "";
			}
			if (data.color !== undefined) {
				payload.color = data.color;
			}

			updateMutation.mutate(payload);
		},
		[updateMutation],
	);

	const handleDeleteSticky = useCallback(
		(id: string) => {
			deleteMutation.mutate({ id });
		},
		[deleteMutation],
	);

	const handleClosePreview = useCallback(() => {
		setShowNewSticky(false);
		setNewStickyData(null);
	}, []);

	const previewSticky = showNewSticky ? newStickyData : null;
	const isDockVisible = isExpanded || showPreview || isAllStickiesOpen;

	return (
		<div ref={containerRef} className="fixed bottom-4 right-4 z-50">
			<div className="group relative h-16 w-16">
				<div
					className={cn(
						"absolute bottom-0 right-0 transition-all duration-200 ease-out",
						isDockVisible
							? "opacity-100 scale-100 pointer-events-auto"
							: "opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto",
					)}
				>
					<div className="relative flex flex-col items-end">
						{/* Sticky Preview */}
						<div
							className={cn(
								"absolute bottom-12 right-0 z-20 w-[290px]",
								"transition-all duration-300 ease-in-out",
								showPreview
									? "translate-y-0 opacity-100"
									: "translate-y-4 opacity-0 pointer-events-none",
							)}
						>
							{previewSticky && (
								<StickyNote
									sticky={previewSticky}
									onUpdate={(data) => {
										if (previewSticky.id) {
											handleUpdateSticky(
												previewSticky.id,
												data,
											);
										}
									}}
									onDelete={
										previewSticky.id
											? () =>
													handleDeleteSticky(
														previewSticky.id!,
													)
											: undefined
									}
									onClose={handleClosePreview}
									isDeleting={
										deleteMutation.isPending &&
										deleteMutation.variables?.id ===
											previewSticky.id
									}
									showToolbar
									autoFocus={showNewSticky}
									className="shadow-xl"
								/>
							)}
						</div>

						<div className="flex flex-col items-center rounded-full border border-border/50 bg-background/70 p-1 shadow-md backdrop-blur">
							{/* Menu Items (expand upward) */}
							<div
								className={cn(
									"flex flex-col gap-2",
									"transition-all duration-300 ease-in-out origin-bottom",
									isExpanded
										? "scale-y-100 opacity-100"
										: "scale-y-0 opacity-0 h-0 overflow-hidden",
								)}
							>
								{/* All Stickies Button */}
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="outline"
											size="icon"
											className="h-9 w-9 rounded-full shadow-sm bg-background"
											onClick={handleOpenAllStickies}
										>
											<ListIcon className="h-4 w-4" />
											<span className="sr-only">
												All stickies
											</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent side="left" sideOffset={10}>
										<span className="text-xs font-medium">
											All stickies
										</span>
									</TooltipContent>
								</Tooltip>

								{/* Create New Button */}
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="outline"
											size="icon"
											className="h-9 w-9 rounded-full shadow-sm bg-background"
											onClick={handleCreateNew}
											disabled={createMutation.isPending}
										>
											{createMutation.isPending ? (
												<span className="size-4 border-2 border-t-transparent border-foreground rounded-full animate-spin" />
											) : (
												<PlusIcon className="h-4 w-4" />
											)}
											<span className="sr-only">
												Create new sticky
											</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent side="left" sideOffset={10}>
										<span className="text-xs font-medium">
											Add sticky
										</span>
									</TooltipContent>
								</Tooltip>
							</div>

							{/* Main Toggle Button */}
							<Button
								variant="ghost"
								size="icon"
								className={cn(
									"h-9 w-9 rounded-full border border-border/60 bg-background/80 text-foreground/70 shadow-sm",
									"transition-colors hover:bg-background",
								)}
								onClick={handleToggle}
							>
								{isExpanded ? (
									<XIcon className="h-4 w-4" />
								) : (
									<StickyNoteIcon className="h-4 w-4" />
								)}
								<span className="sr-only">
									{isExpanded
										? "Close stickies menu"
										: "Open stickies menu"}
								</span>
							</Button>
						</div>
					</div>
				</div>
			</div>

			<StickiesModal
				open={isAllStickiesOpen}
				onOpenChange={setIsAllStickiesOpen}
				onCreate={handleCreateFromModal}
				onUpdate={handleUpdateSticky}
				onDelete={handleDeleteSticky}
				isCreating={createMutation.isPending}
				isDeleting={deleteMutation.isPending}
				deletingId={deleteMutation.variables?.id}
			/>
		</div>
	);
}
