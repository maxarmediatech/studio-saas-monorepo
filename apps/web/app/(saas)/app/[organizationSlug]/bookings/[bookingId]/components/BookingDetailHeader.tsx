"use client";

import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import {
	ArchiveIcon,
	ChevronLeftIcon,
	CopyIcon,
	ListIcon,
	MoreHorizontalIcon,
	PencilIcon,
	Trash2Icon,
} from "lucide-react";
import { useBookingSidebarSafe } from "./sidebar/booking-sidebar-context";
import Link from "next/link";

/**
 * Toggle button for the booking list sidebar
 * Uses safe hook to gracefully handle cases outside provider
 */
function BookingListToggle() {
	const sidebar = useBookingSidebarSafe();
	if (!sidebar) return null;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={cn(
						"hidden h-8 w-8 p-0 md:flex",
						sidebar.isExpanded && "bg-accent",
					)}
					onClick={sidebar.toggleSidebar}
				>
					<ListIcon className="h-4 w-4" />
					<span className="sr-only">Toggle booking list</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">
				<span>Booking list</span>
				<kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
					⌘]
				</kbd>
			</TooltipContent>
		</Tooltip>
	);
}

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
		<div className={cn("flex w-full items-center justify-between gap-4", className)}>
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
				<BookingListToggle />
			</div>
		</div>
	);
}