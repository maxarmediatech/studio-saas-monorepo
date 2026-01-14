"use client";

import {
	ArrowRightIcon,
	CalendarIcon,
	CameraIcon,
	CheckSquareIcon,
	PackageIcon,
	ReceiptIcon,
	UserIcon,
	UsersIcon,
	WalletIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	CommandDialog,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "../command";
import { GlobalSearchEmpty } from "./global-search-empty";
import { GlobalSearchLoading } from "./global-search-loading";
import { useGlobalSearchContext } from "./global-search-provider";
import type { EntityConfig, GlobalSearchResponse } from "./types";

// Entity configuration
const ENTITY_CONFIG: Record<keyof GlobalSearchResponse, EntityConfig> = {
	bookings: {
		icon: CalendarIcon,
		label: "Bookings",
		color: "text-blue-500",
		bgColor: "bg-blue-500/10",
		singularLabel: "booking",
	},
	clients: {
		icon: UserIcon,
		label: "Clients",
		color: "text-green-500",
		bgColor: "bg-green-500/10",
		singularLabel: "client",
	},
	crews: {
		icon: UsersIcon,
		label: "Crew",
		color: "text-purple-500",
		bgColor: "bg-purple-500/10",
		singularLabel: "crew member",
	},
	shoots: {
		icon: CameraIcon,
		label: "Shoots",
		color: "text-orange-500",
		bgColor: "bg-orange-500/10",
		singularLabel: "shoot",
	},
	tasks: {
		icon: CheckSquareIcon,
		label: "Tasks",
		color: "text-yellow-600",
		bgColor: "bg-yellow-500/10",
		singularLabel: "task",
	},
	deliverables: {
		icon: PackageIcon,
		label: "Deliverables",
		color: "text-pink-500",
		bgColor: "bg-pink-500/10",
		singularLabel: "deliverable",
	},
	expenses: {
		icon: WalletIcon,
		label: "Expenses",
		color: "text-red-500",
		bgColor: "bg-red-500/10",
		singularLabel: "expense",
	},
	invoices: {
		icon: ReceiptIcon,
		label: "Invoices",
		color: "text-cyan-500",
		bgColor: "bg-cyan-500/10",
		singularLabel: "invoice",
	},
};

interface GlobalSearchModalProps {
	onSearch: (query: string) => Promise<GlobalSearchResponse>;
	onSelect: (
		entityType: string,
		id: string,
		item: Record<string, unknown>,
	) => void;
	onViewAll: (entityType: string, query: string) => void;
	debounceMs?: number;
}

export function GlobalSearchModal({
	onSearch,
	onSelect,
	onViewAll,
	debounceMs = 300,
}: GlobalSearchModalProps) {
	const { isOpen, close } = useGlobalSearchContext();
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [results, setResults] = useState<GlobalSearchResponse | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Debounce the query
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(query);
		}, debounceMs);

		return () => clearTimeout(timer);
	}, [query, debounceMs]);

	// Reset state when modal closes
	useEffect(() => {
		if (!isOpen) {
			setQuery("");
			setDebouncedQuery("");
			setResults(null);
			setError(null);
		}
	}, [isOpen]);

	// Fetch results when debounced query changes
	useEffect(() => {
		const trimmed = debouncedQuery.trim();

		// Minimum 2 characters
		if (trimmed.length < 2) {
			setResults(null);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		onSearch(trimmed)
			.then((data) => {
				setResults(data);
			})
			.catch((err) => {
				console.error("Search error:", err);
				setError("Failed to search. Please try again.");
				setResults(null);
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, [debouncedQuery, onSearch]);

	// Handle item selection
	const handleSelect = useCallback(
		(entityType: string, id: string, item: Record<string, unknown>) => {
			onSelect(entityType, id, item);
			close();
		},
		[onSelect, close],
	);

	// Handle "View all" click
	const handleViewAll = useCallback(
		(entityType: string) => {
			onViewAll(entityType, query);
			close();
		},
		[onViewAll, query, close],
	);

	// Calculate if there are any results
	const hasResults =
		results &&
		Object.values(results).some(
			(arr) => Array.isArray(arr) && arr.length > 0,
		);

	// Calculate total results count
	const totalResults = results
		? Object.values(results).reduce(
				(sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
				0,
			)
		: 0;

	return (
		<CommandDialog
			open={isOpen}
			onOpenChange={(open) => !open && close()}
			title="Search"
			description="Search across your workspace"
		>
			<CommandInput
				placeholder="Search bookings, clients, crew..."
				value={query}
				onValueChange={setQuery}
			/>

			<CommandList className="max-h-[400px]">
				{/* Loading State */}
				{isLoading && <GlobalSearchLoading />}

				{/* Error State */}
				{error && !isLoading && (
					<div className="py-6 text-center text-sm text-destructive">
						{error}
					</div>
				)}

				{/* Empty State - Query too short */}
				{!isLoading &&
					!error &&
					query.trim().length > 0 &&
					query.trim().length < 2 && (
						<div className="py-6 text-center text-sm text-muted-foreground">
							Type at least 2 characters to search
						</div>
					)}

				{/* Empty State - No results */}
				{!isLoading &&
					!error &&
					debouncedQuery.trim().length >= 2 &&
					!hasResults && <GlobalSearchEmpty query={debouncedQuery} />}

				{/* Results */}
				{!isLoading &&
					!error &&
					hasResults &&
					Object.entries(results).map(([entityType, items]) => {
						if (!Array.isArray(items) || items.length === 0)
							return null;

						const config =
							ENTITY_CONFIG[
								entityType as keyof GlobalSearchResponse
							];
						if (!config) return null;

						const Icon = config.icon;

						return (
							<CommandGroup
								key={entityType}
								heading={
									<div className="flex items-center justify-between">
										<span className="flex items-center gap-2">
											<Icon
												className={`h-4 w-4 ${config.color}`}
											/>
											{config.label}
										</span>
										<span className="text-xs text-muted-foreground">
											{items.length} result
											{items.length !== 1 ? "s" : ""}
										</span>
									</div>
								}
							>
								{items.map((item: Record<string, unknown>) => {
									const id = item.id as string;

									return (
										<CommandItem
											key={id}
											value={`${entityType}-${id}`}
											onSelect={() =>
												handleSelect(
													entityType,
													id,
													item,
												)
											}
											className="flex items-center gap-3"
										>
											<div
												className={`flex h-8 w-8 items-center justify-center rounded-md ${config.bgColor}`}
											>
												<Icon
													className={`h-4 w-4 ${config.color}`}
												/>
											</div>
											<div className="flex flex-col min-w-0 flex-1">
												<span className="font-medium truncate">
													{(item.name as string) ||
														(item.description as string) ||
														(item.referenceNumber as string) ||
														(item.invoiceNumber as string)}
												</span>
												{typeof item.referenceNumber ===
													"string" &&
													typeof item.name ===
														"string" && (
														<span className="text-xs text-muted-foreground">
															{
																item.referenceNumber
															}
														</span>
													)}
												{typeof item.email ===
													"string" && (
													<span className="text-xs text-muted-foreground truncate">
														{item.email}
													</span>
												)}
												{typeof item.role ===
													"string" && (
													<span className="text-xs text-muted-foreground">
														{item.role}
													</span>
												)}
											</div>
										</CommandItem>
									);
								})}

								{/* View All link */}
								<CommandItem
									value={`view-all-${entityType}`}
									onSelect={() => handleViewAll(entityType)}
									className="flex items-center justify-between text-muted-foreground"
								>
									<span>
										View all {config.label.toLowerCase()}
									</span>
									<ArrowRightIcon className="h-4 w-4" />
								</CommandItem>
							</CommandGroup>
						);
					})}

				{/* Results summary */}
				{!isLoading && hasResults && totalResults > 0 && (
					<>
						<CommandSeparator />
						<div className="py-2 px-4 text-xs text-muted-foreground">
							Found {totalResults} result
							{totalResults !== 1 ? "s" : ""} for "
							{debouncedQuery}"
						</div>
					</>
				)}
			</CommandList>
		</CommandDialog>
	);
}
