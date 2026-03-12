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
		<div className="group relative flex w-full items-center sm:w-auto">
			<Link
				href={link.url}
				target="_blank"
				rel="noopener noreferrer"
				className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 pr-10 transition-colors hover:bg-muted/50 sm:w-auto sm:flex-initial sm:py-1.5"
			>
				<span
					aria-hidden="true"
					className="size-4 rounded-sm bg-cover bg-center bg-no-repeat"
					style={{ backgroundImage: `url(${faviconUrl})` }}
				/>
				<span className="truncate text-sm font-medium sm:max-w-[150px]">
					{displayName}
				</span>
			</Link>

			<div className="absolute right-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
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
