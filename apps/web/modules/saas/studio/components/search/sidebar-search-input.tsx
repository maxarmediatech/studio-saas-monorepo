"use client";

import { cn } from "@repo/ui/lib/utils";
import { SearchIcon } from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface SidebarSearchInputProps {
	className?: string;
}

export function SidebarSearchInput({ className }: SidebarSearchInputProps) {
	const router = useRouter();
	const pathname = usePathname();
	const params = useParams<{ organizationSlug: string }>();
	const organizationSlug = params?.organizationSlug;

	const [inputValue, setInputValue] = useState("");
	const isOnSearchPage = pathname?.includes("/search");

	// Sync input with URL when on search page
	useEffect(() => {
		if (isOnSearchPage && typeof window !== "undefined") {
			const url = new URL(window.location.href);
			const q = url.searchParams.get("q") || "";
			setInputValue(q);
		} else {
			setInputValue("");
		}
	}, [isOnSearchPage, pathname]);

	// Navigate to search page
	const handleNavigateToSearch = useCallback(() => {
		if (!organizationSlug) return;
		const searchUrl = `/app/${organizationSlug}/search${inputValue ? `?q=${encodeURIComponent(inputValue)}` : ""}`;
		router.push(searchUrl);
	}, [router, organizationSlug, inputValue]);

	// Handle input change - navigate to search if we have a value
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setInputValue(value);

			// If on search page, update URL
			if (isOnSearchPage && organizationSlug) {
				const searchUrl = `/app/${organizationSlug}/search${value ? `?q=${encodeURIComponent(value)}` : ""}`;
				router.replace(searchUrl);
			}
		},
		[isOnSearchPage, organizationSlug, router],
	);

	// Handle key down
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter" && !isOnSearchPage) {
				handleNavigateToSearch();
			}
		},
		[isOnSearchPage, handleNavigateToSearch],
	);

	// Handle focus - navigate to search page if not already there
	const handleFocus = useCallback(() => {
		if (!isOnSearchPage) {
			handleNavigateToSearch();
		}
	}, [isOnSearchPage, handleNavigateToSearch]);

	// Cmd+K shortcut to focus search
	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				handleNavigateToSearch();
			}
		};

		document.addEventListener("keydown", handleGlobalKeyDown);
		return () =>
			document.removeEventListener("keydown", handleGlobalKeyDown);
	}, [handleNavigateToSearch]);

	return (
		<div
			className={cn(
				"flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm transition-colors hover:border-neutral-300 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400",
				className,
			)}
		>
			<SearchIcon className="size-4 shrink-0 text-neutral-400" />
			<input
				type="text"
				value={inputValue}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				onFocus={handleFocus}
				placeholder="Search..."
				className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
				autoComplete="off"
				spellCheck={false}
			/>
			<kbd className="hidden shrink-0 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400 sm:inline">
				⌘K
			</kbd>
		</div>
	);
}
