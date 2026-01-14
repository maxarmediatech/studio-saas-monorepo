"use client";

import { cn } from "@repo/ui/lib/utils";
import { SearchIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SearchCommandModal } from "./search-command-modal";

interface HeaderSearchInputProps {
	className?: string;
}

export function HeaderSearchInput({ className }: HeaderSearchInputProps) {
	const [isOpen, setIsOpen] = useState(false);

	const openModal = useCallback(() => setIsOpen(true), []);
	const closeModal = useCallback(() => setIsOpen(false), []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				openModal();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [openModal]);

	return (
		<>
			<button
				type="button"
				onClick={openModal}
				className={cn(
					"flex h-8 w-full items-center gap-2 rounded-md border border-neutral-300/80 px-3 text-sm text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-neutral-100/50",
					className,
				)}
			>
				<SearchIcon className="size-4 shrink-0 text-neutral-400" />
				<span className="text-neutral-400">Search</span>
			</button>

			<SearchCommandModal isOpen={isOpen} onClose={closeModal} />
		</>
	);
}
