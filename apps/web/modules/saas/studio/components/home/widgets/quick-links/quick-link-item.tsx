"use client";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
	CopyIcon,
	ExternalLinkIcon,
	MoreHorizontalIcon,
	PencilIcon,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface QuickLink {
	id: string;
	url: string;
	title?: string | null;
}

interface QuickLinkItemProps {
	link: QuickLink;
	onEdit: (link: QuickLink) => void;
	onDelete: (id: string) => void;
}

export function QuickLinkItem({ link, onEdit, onDelete }: QuickLinkItemProps) {
	const hostname = new URL(link.url).hostname;
	const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
	const displayName = link.title || hostname;

	const handleCopy = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		navigator.clipboard.writeText(link.url);
		toast.success("Link copied to clipboard");
	};

	const handleDelete = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (
			window.confirm("Are you sure you want to delete this quick link?")
		) {
			onDelete(link.id);
		}
	};

	return (
		<div className="group relative flex items-center">
			<Link
				href={link.url}
				target="_blank"
				rel="noopener noreferrer"
				className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors pr-8"
			>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={faviconUrl}
					alt=""
					className="size-4 rounded-sm"
					onError={(e) => {
						e.currentTarget.style.display = "none";
					}}
				/>
				<span className="text-sm font-medium max-w-[150px] truncate">
					{displayName}
				</span>
			</Link>

			<div className="absolute right-1 opacity-0 group-hover:opacity-100 transition-opacity">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="p-1 hover:bg-background rounded-md text-muted-foreground hover:text-foreground"
						>
							<MoreHorizontalIcon className="size-3" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							onClick={() => window.open(link.url, "_blank")}
						>
							<ExternalLinkIcon className="mr-2 size-3.5" />
							Open in new tab
						</DropdownMenuItem>
						<DropdownMenuItem onClick={handleCopy}>
							<CopyIcon className="mr-2 size-3.5" />
							Copy link
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onEdit(link)}>
							<PencilIcon className="mr-2 size-3.5" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={handleDelete}
							className="text-destructive focus:text-destructive"
						>
							<TrashIcon className="mr-2 size-3.5" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
