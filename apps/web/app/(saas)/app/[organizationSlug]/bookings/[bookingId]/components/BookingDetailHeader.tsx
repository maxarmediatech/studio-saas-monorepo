"use client";

import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import {
	ArchiveIcon,
	ChevronLeftIcon,
	CopyIcon,
	MoreHorizontalIcon,
	PencilIcon,
	Trash2Icon,
} from "lucide-react";
import Link from "next/link";

interface BookingDetailHeaderProps {
	backHref: string;
	referenceNumber?: string;
	onEdit?: () => void;
	onDuplicate?: () => void;
	onArchive?: () => void;
	onDelete?: () => void;
	className?: string;
}

/**
 * Minimal Header component for booking detail page
 * Displays: back button and actions dropdown
 */
export function BookingDetailHeader({
	backHref,
	referenceNumber,
	onEdit,
	onDuplicate,
	onArchive,
	onDelete,
	className,
}: BookingDetailHeaderProps) {
	return (
		<div className={cn("flex items-center justify-between gap-4", className)}>
			{/* Left: Breadcrumb navigation */}
			<div className="flex items-center gap-2 min-w-0">
				<Link
					href={backHref}
					className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground shrink-0"
				>
					<ChevronLeftIcon className="h-4 w-4" />
					<span className="text-sm font-medium">Bookings</span>
				</Link>
				{referenceNumber && (
					<>
						<span className="text-muted-foreground/60">/</span>
						<h1 className="text-sm font-semibold truncate">{referenceNumber}</h1>
					</>
				)}
			</div>

			{/* Right: Actions */}
			<div className="flex items-center gap-2 shrink-0">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
							<MoreHorizontalIcon className="h-4 w-4" />
							<span className="sr-only">More actions</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{onEdit && (
							<DropdownMenuItem onClick={onEdit}>
								<PencilIcon className="h-4 w-4 mr-2" />
								Edit Booking
							</DropdownMenuItem>
						)}
						{onDuplicate && (
							<DropdownMenuItem onClick={onDuplicate}>
								<CopyIcon className="h-4 w-4 mr-2" />
								Duplicate
							</DropdownMenuItem>
						)}
						{onArchive && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={onArchive}>
									<ArchiveIcon className="h-4 w-4 mr-2" />
									Archive
								</DropdownMenuItem>
							</>
						)}
						{onDelete && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={onDelete}
									className="text-destructive focus:text-destructive"
								>
									<Trash2Icon className="h-4 w-4 mr-2" />
									Delete
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}