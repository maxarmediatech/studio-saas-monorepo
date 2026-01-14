"use client";

import { Button } from "@repo/ui/components/button";
import { useGlobalSearchContext } from "@repo/ui/components/global-search";
import { SearchIcon } from "lucide-react";

interface GlobalSearchTriggerProps {
	className?: string;
}

export function GlobalSearchTrigger({ className }: GlobalSearchTriggerProps) {
	const { open } = useGlobalSearchContext();

	return (
		<Button variant="ghost" size="sm" onClick={open} className={className}>
			<SearchIcon className="h-4 w-4 mr-2" />
			<span className="hidden sm:inline">Search</span>
			<kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
				<span className="text-xs">⌘</span>K
			</kbd>
		</Button>
	);
}
