"use client";

import { cn } from "@repo/ui/lib/utils";
import { orpcClient } from "@shared/lib/orpc-client";
import { Loader2, SearchIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useRef, useState } from "react";
import { ENTITY_DISPLAY_CONFIG, getEntityCount, SEARCH_TABS } from "./config";
import type {
	SearchEntityType,
	SearchResultItem,
	SearchResults,
} from "./types";

const EMPTY_RESULTS: SearchResults = {
	bookings: [],
	clients: [],
	crews: [],
	shoots: [],
	tasks: [],
	deliverables: [],
	expenses: [],
	invoices: [],
};

interface SearchPageClientProps {
	organizationSlug: string;
}

export function SearchPageClient({ organizationSlug }: SearchPageClientProps) {
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement>(null);

	// URL state for search query
	const [query, setQuery] = useQueryState(
		"q",
		parseAsString.withDefault("").withOptions({ throttleMs: 300 }),
	);

	// Local state
	const [activeTab, setActiveTab] = useState<SearchEntityType>("all");
	const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
	const [isLoading, setIsLoading] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);

	// Get flattened results for keyboard navigation
	const flatResults = useCallback(() => {
		const items: {
			entityType: keyof SearchResults;
			item: SearchResultItem;
		}[] = [];

		if (activeTab === "all") {
			for (const [entityType, entityResults] of Object.entries(results)) {
				if (entityResults && entityResults.length > 0) {
					for (const item of entityResults) {
						items.push({
							entityType: entityType as keyof SearchResults,
							item,
						});
					}
				}
			}
		} else {
			const entityResults = results[activeTab];
			if (entityResults && entityResults.length > 0) {
				for (const item of entityResults) {
					items.push({ entityType: activeTab, item });
				}
			}
		}

		return items;
	}, [results, activeTab]);

	// Fetch results when query changes
	useEffect(() => {
		const trimmed = query.trim();

		if (trimmed.length < 2) {
			setResults(EMPTY_RESULTS);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);

		orpcClient.globalSearch
			.search({
				query: trimmed,
				limit: 10,
			})
			.then((data) => {
				setResults({
					bookings: (data.bookings ?? []) as SearchResultItem[],
					clients: (data.clients ?? []) as SearchResultItem[],
					crews: (data.crews ?? []) as SearchResultItem[],
					shoots: (data.shoots ?? []) as SearchResultItem[],
					tasks: (data.tasks ?? []) as SearchResultItem[],
					deliverables: (data.deliverables ??
						[]) as SearchResultItem[],
					expenses: (data.expenses ?? []) as SearchResultItem[],
					invoices: (data.invoices ?? []) as SearchResultItem[],
				});
				setSelectedIndex(0);
			})
			.catch((error) => {
				console.error("Search error:", error);
				setResults(EMPTY_RESULTS);
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, [query]);

	// Focus input on mount
	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	// Reset selected index when tab changes
	useEffect(() => {
		setSelectedIndex(0);
	}, [activeTab]);

	// Handle item navigation
	const handleNavigate = useCallback(
		(entityType: keyof SearchResults, id: string) => {
			const config = ENTITY_DISPLAY_CONFIG[entityType];
			router.push(`/app/${organizationSlug}/${config.route}/${id}`);
		},
		[router, organizationSlug],
	);

	// Keyboard navigation
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const items = flatResults();

			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((prev) =>
					Math.min(prev + 1, items.length - 1),
				);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((prev) => Math.max(prev - 1, 0));
			} else if (e.key === "Enter" && items.length > 0) {
				e.preventDefault();
				const selected = items[selectedIndex];
				if (selected) {
					handleNavigate(selected.entityType, selected.item.id);
				}
			} else if (e.key === "Escape") {
				e.preventDefault();
				if (query) {
					setQuery("");
				} else {
					router.back();
				}
			}
		},
		[flatResults, selectedIndex, handleNavigate, query, setQuery, router],
	);

	// Clear search
	const handleClear = useCallback(() => {
		setQuery("");
		inputRef.current?.focus();
	}, [setQuery]);

	// Get visible results based on active tab
	const getVisibleResults = useCallback((): {
		entityType: keyof SearchResults;
		items: SearchResultItem[];
	}[] => {
		if (activeTab === "all") {
			return (Object.keys(results) as (keyof SearchResults)[])
				.filter((key) => results[key]?.length > 0)
				.map((key) => ({ entityType: key, items: results[key] }));
		}

		const items = results[activeTab];
		if (!items || items.length === 0) return [];
		return [{ entityType: activeTab, items }];
	}, [results, activeTab]);

	const visibleResults = getVisibleResults();
	const totalCount = getEntityCount(results, "all");
	const hasResults = totalCount > 0;
	const hasQuery = query.trim().length >= 2;

	// Track current flat index for highlighting
	let flatIndex = 0;

	return (
		<div
			className="flex h-full flex-col bg-white"
			onKeyDown={handleKeyDown}
		>
			{/* Search Header */}
			<div className="border-b border-neutral-200 bg-white">
				{/* Search Input */}
				<div className="flex items-center gap-3 px-4 py-3">
					<SearchIcon className="size-5 shrink-0 text-neutral-400" />
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search bookings, clients, crew, shoots..."
						className="flex-1 bg-transparent text-base outline-none placeholder:text-neutral-400"
						autoComplete="off"
						spellCheck={false}
					/>
					{query && (
						<button
							type="button"
							onClick={handleClear}
							className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
						>
							<XIcon className="size-4" />
						</button>
					)}
					{isLoading && (
						<Loader2 className="size-4 animate-spin text-neutral-400" />
					)}
				</div>

				{/* Tabs */}
				<div className="flex items-center gap-1 overflow-x-auto px-4 pb-2">
					{SEARCH_TABS.map((tab) => {
						const count =
							tab.id === "all"
								? totalCount
								: getEntityCount(results, tab.id);
						const isActive = activeTab === tab.id;
						const showCount = hasQuery && count > 0;

						return (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTab(tab.id)}
								className={cn(
									"flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
									isActive
										? "bg-blue-100 text-blue-700"
										: "text-neutral-600 hover:bg-neutral-100",
								)}
							>
								{tab.label}
								{showCount && (
									<span
										className={cn(
											"ml-0.5 text-xs",
											isActive
												? "text-blue-600"
												: "text-neutral-400",
										)}
									>
										{count}
									</span>
								)}
							</button>
						);
					})}
				</div>
			</div>

			{/* Results Area */}
			<div className="flex-1 overflow-y-auto">
				{/* Search prompt */}
				{!hasQuery && (
					<div className="p-8 text-center text-neutral-500">
						<SearchIcon className="mx-auto mb-3 size-12 text-neutral-300" />
						<p className="text-lg font-medium">
							Search across your workspace
						</p>
						<p className="mt-1 text-sm">
							Type at least 2 characters to search
						</p>
					</div>
				)}

				{/* Loading state */}
				{hasQuery && isLoading && (
					<div className="p-8 text-center">
						<Loader2 className="mx-auto size-8 animate-spin text-neutral-400" />
						<p className="mt-2 text-sm text-neutral-500">
							Searching...
						</p>
					</div>
				)}

				{/* No results */}
				{hasQuery && !isLoading && !hasResults && (
					<div className="p-8 text-center text-neutral-500">
						<p className="text-lg font-medium">No results found</p>
						<p className="mt-1 text-sm">
							Try a different search term or check another
							category
						</p>
					</div>
				)}

				{/* Results */}
				{hasQuery && !isLoading && hasResults && (
					<div className="divide-y divide-neutral-100">
						{visibleResults.map(({ entityType, items }) => {
							const config = ENTITY_DISPLAY_CONFIG[entityType];
							const Icon = config.icon;

							return (
								<div key={entityType} className="py-2">
									{/* Section header - only show in "all" tab */}
									{activeTab === "all" && (
										<div className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
											{config.label}
										</div>
									)}

									{/* Items */}
									<div>
										{items.map((item) => {
											const currentIndex = flatIndex++;
											const isSelected =
												currentIndex === selectedIndex;
											const displayName =
												config.getDisplayName(item);
											const subtext =
												config.getSubtext?.(item);

											return (
												<button
													key={item.id}
													type="button"
													onClick={() =>
														handleNavigate(
															entityType,
															item.id,
														)
													}
													className={cn(
														"flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
														isSelected
															? "bg-blue-50"
															: "hover:bg-neutral-50",
													)}
												>
													<div
														className={cn(
															"flex size-8 shrink-0 items-center justify-center rounded",
															config.bgColor,
														)}
													>
														<Icon
															className={cn(
																"size-4",
																config.color,
															)}
														/>
													</div>
													<div className="min-w-0 flex-1">
														<div className="flex items-center gap-2">
															{subtext && (
																<span className="shrink-0 text-xs font-medium text-neutral-400">
																	{subtext}
																</span>
															)}
															<span className="truncate font-medium text-neutral-900">
																{displayName}
															</span>
														</div>
													</div>
												</button>
											);
										})}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Footer with keyboard shortcuts */}
			<div className="flex shrink-0 items-center justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-500">
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-1">
						<kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">
							&uarr;
						</kbd>
						<kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">
							&darr;
						</kbd>
						<span className="ml-1">Select</span>
					</div>
					<div className="flex items-center gap-1">
						<kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">
							Enter
						</kbd>
						<span className="ml-1">Open</span>
					</div>
					<div className="flex items-center gap-1">
						<kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">
							Esc
						</kbd>
						<span className="ml-1">Clear / Back</span>
					</div>
				</div>
			</div>
		</div>
	);
}
