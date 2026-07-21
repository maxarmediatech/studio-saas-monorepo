"use client";

import { ScrollArea, ScrollBar } from "@repo/ui/components/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import { getPreferredScrollBehavior } from "@shared/lib/motion";
import { orpcClient } from "@shared/lib/orpc-client";
import { Loader2, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
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

const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

interface SearchCommandModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export function SearchCommandModal({
	isOpen,
	onClose,
}: SearchCommandModalProps) {
	const router = useRouter();
	const params = useParams<{ organizationSlug: string }>();
	const organizationSlug = params?.organizationSlug ?? "";

	const inputRef = useRef<HTMLInputElement>(null);
	const resultsRef = useRef<HTMLDivElement>(null);

	const [query, setQuery] = useState("");
	const [activeTab, setActiveTab] = useState<SearchEntityType>("all");
	const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
	const [isLoading, setIsLoading] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const mounted = useSyncExternalStore(
		subscribeToClient,
		getClientSnapshot,
		getServerSnapshot,
	);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setQuery("");
		setResults(EMPTY_RESULTS);
		setSelectedIndex(0);
		setActiveTab("all");
		const focusTimer = window.setTimeout(
			() => inputRef.current?.focus(),
			0,
		);

		return () => window.clearTimeout(focusTimer);
	}, [isOpen]);

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

	useEffect(() => {
		const trimmed = query.trim();

		if (trimmed.length < 2) {
			setResults(EMPTY_RESULTS);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);

		const timeoutId = setTimeout(() => {
			orpcClient.globalSearch
				.search({ query: trimmed, limit: 10 })
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
		}, 150);

		return () => clearTimeout(timeoutId);
	}, [query]);

	useEffect(() => {
		setSelectedIndex(0);
	}, [activeTab]);

	useEffect(() => {
		const container = resultsRef.current;
		if (!container) {
			return;
		}

		const target = container.querySelector<HTMLElement>(
			`[data-search-index="${selectedIndex}"]`,
		);

		if (target) {
			target.scrollIntoView({
				block: "nearest",
				behavior: getPreferredScrollBehavior(),
			});
		}
	}, [selectedIndex, results, activeTab]);

	const handleNavigate = useCallback(
		(entityType: keyof SearchResults, id: string) => {
			const config = ENTITY_DISPLAY_CONFIG[entityType];
			router.push(`/app/${organizationSlug}/${config.route}/${id}`);
			onClose();
		},
		[router, organizationSlug, onClose],
	);

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
				onClose();
			}
		},
		[flatResults, selectedIndex, handleNavigate, onClose],
	);

	const handleOverlayClick = useCallback(
		(e: React.MouseEvent) => {
			if (e.target === e.currentTarget) {
				onClose();
			}
		},
		[onClose],
	);

	const totalCount = getEntityCount(results, "all");
	const hasResults = totalCount > 0;
	const hasQuery = query.trim().length >= 2;

	let flatIndex = 0;

	if (!mounted || !isOpen) {
		return null;
	}

	return createPortal(
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Search studio"
			className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[10vh]"
			onClick={handleOverlayClick}
			onKeyDown={handleKeyDown}
		>
			<div className="flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-2xl">
				<div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3">
					<SearchIcon className="size-5 shrink-0 text-neutral-400" />
					<input
						aria-label="Search studio"
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search clients, bookings, venues, amounts..."
						className="flex-1 bg-transparent text-base outline-none placeholder:text-neutral-400"
						autoComplete="off"
						spellCheck={false}
					/>
					{query && !isLoading && (
						<button
							aria-label="Clear search"
							type="button"
							onClick={() => {
								setQuery("");
								inputRef.current?.focus();
							}}
							className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
						>
							<XIcon className="size-4" />
						</button>
					)}
					{isLoading && (
						<Loader2 className="size-4 animate-spin text-neutral-400" />
					)}
				</div>

				<ScrollArea className="border-b border-neutral-100">
					<div className="flex w-max items-center gap-1 px-4 py-2">
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
										"flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
										isActive
											? "bg-neutral-100 text-neutral-900"
											: "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700",
									)}
								>
									{tab.label}
									{showCount && (
										<span
											className={cn(
												"text-xs",
												isActive
													? "text-neutral-600"
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
					<ScrollBar orientation="horizontal" />
				</ScrollArea>

				<div className="flex-1 overflow-y-auto" ref={resultsRef}>
					<Link
						href={`/app/${organizationSlug}/search${query ? `?q=${encodeURIComponent(query)}` : ""}`}
						onClick={onClose}
						className="flex items-center gap-3 border-b border-neutral-100 px-4 py-2.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-50"
					>
						<SearchIcon className="size-4 text-neutral-400" />
						<span>Go to advanced search page</span>
					</Link>

					{hasQuery && hasResults && (
						<div className="px-2 py-2">
							<div className="px-2 py-1.5 text-xs font-medium text-neutral-400">
								Search results
							</div>

							{(activeTab === "all"
								? (
										Object.keys(
											results,
										) as (keyof SearchResults)[]
									).filter((key) => results[key]?.length > 0)
								: [activeTab]
							).map((entityType) => {
								const items = results[entityType];
								if (!items || items.length === 0) {
									return null;
								}

								const config =
									ENTITY_DISPLAY_CONFIG[entityType];
								const Icon = config.icon;

								return items.map((item) => {
									const currentIndex = flatIndex++;
									const isSelected =
										currentIndex === selectedIndex;
									const displayName =
										config.getDisplayName(item);
									const subtext = config.getSubtext?.(item);

									return (
										<button
											key={`${entityType}-${item.id}`}
											type="button"
											onClick={() =>
												handleNavigate(
													entityType,
													item.id,
												)
											}
											data-search-index={currentIndex}
											className={cn(
												"flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
												isSelected
													? "bg-neutral-100"
													: "hover:bg-neutral-50",
											)}
										>
											<Icon
												className={cn(
													"size-4 shrink-0",
													config.color,
												)}
											/>
											{subtext && (
												<span className="shrink-0 text-xs font-medium text-neutral-400">
													{subtext}
												</span>
											)}
											<span className="truncate text-sm text-neutral-900">
												{displayName}
											</span>
										</button>
									);
								});
							})}
						</div>
					)}

					{hasQuery && !isLoading && !hasResults && (
						<div className="px-4 py-8 text-center text-sm text-neutral-500">
							No results found
						</div>
					)}

					{!hasQuery && (
						<div className="px-4 py-8 text-center text-sm text-neutral-400">
							Type to search across your workspace
						</div>
					)}
				</div>

				<div className="flex items-center gap-4 border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-500">
					<div className="flex items-center gap-1">
						<kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">
							↑
						</kbd>
						<kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">
							↓
						</kbd>
						<span className="ml-1">Select</span>
					</div>
					<div className="flex items-center gap-1">
						<kbd className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">
							Enter
						</kbd>
						<span className="ml-1">Open</span>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}
