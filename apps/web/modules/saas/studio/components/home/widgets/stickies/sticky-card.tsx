"use client";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { MoreHorizontalIcon, PencilIcon, TrashIcon } from "lucide-react";
import { STICKY_COLORS, type StickyColor } from "./constants";

interface Sticky {
	id: string;
	title: string | null;
	content: string | null;
	color: string;
}

interface StickyCardProps {
	sticky: Sticky;
	onEdit: (sticky: Sticky) => void;
	onDelete: (id: string) => void;
}

export function StickyCard({ sticky, onEdit, onDelete }: StickyCardProps) {
	const colorConfig =
		STICKY_COLORS[sticky.color as StickyColor] || STICKY_COLORS.yellow;

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (
			window.confirm("Are you sure you want to delete this sticky note?")
		) {
			onDelete(sticky.id);
		}
	};

	const handleEdit = (e: React.MouseEvent) => {
		e.stopPropagation();
		onEdit(sticky);
	};

	return (
		<div
			onClick={() => onEdit(sticky)}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onEdit(sticky);
				}
			}}
			className={cn(
				"group relative flex flex-col p-4 rounded-xl border cursor-pointer hover:shadow-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				colorConfig.bg,
				colorConfig.border,
			)}
		>
			<div className="flex items-start justify-between gap-2">
				<h3
					className={cn(
						"font-medium text-sm line-clamp-1 flex-1",
						!sticky.title && "text-muted-foreground italic",
					)}
				>
					{sticky.title || "Untitled"}
				</h3>

				<DropdownMenu>
					<DropdownMenuTrigger
						asChild
						onClick={(e) => e.stopPropagation()}
					>
						<button
							type="button"
							className="opacity-0 group-hover:opacity-100 transition-opacity -mr-2 -mt-2 p-1.5 rounded-full hover:bg-black/5 text-muted-foreground hover:text-foreground focus:opacity-100"
						>
							<MoreHorizontalIcon className="size-4" />
							<span className="sr-only">Open menu</span>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-40">
						<DropdownMenuItem onClick={handleEdit}>
							<PencilIcon className="mr-2 size-4" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={handleDelete}
							className="text-destructive focus:text-destructive"
						>
							<TrashIcon className="mr-2 size-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<p
				className={cn(
					"text-sm text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap",
					!sticky.content && "italic opacity-70",
				)}
			>
				{sticky.content || "No content"}
			</p>
		</div>
	);
}
