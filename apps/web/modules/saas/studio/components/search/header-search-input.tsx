"use client";

import { cn } from "@repo/ui/lib/utils";
import { SearchIcon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

interface HeaderSearchInputProps {
	className?: string;
}

export function HeaderSearchInput({ className }: HeaderSearchInputProps) {
	const router = useRouter();
	const params = useParams<{ organizationSlug: string }>();
	const organizationSlug = params?.organizationSlug;

	const handleClick = useCallback(() => {
		if (!organizationSlug) {
			return;
		}
		router.push(`/app/${organizationSlug}/search`);
	}, [router, organizationSlug]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				handleClick();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [handleClick]);

	return (
		<button
			type="button"
			onClick={handleClick}
			className={cn(
				"flex h-9 w-full max-w-md items-center gap-2 rounded-full border border-neutral-300 bg-neutral-50 px-4 text-sm text-neutral-500 transition-all hover:border-neutral-400 hover:bg-white focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100",
				className,
			)}
		>
			<SearchIcon className="size-4 shrink-0 text-neutral-400" />
			<span className="flex-1 text-left">Search</span>
			<kbd className="hidden shrink-0 rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-neutral-400 sm:inline">
				⌘K
			</kbd>
		</button>
	);
}
