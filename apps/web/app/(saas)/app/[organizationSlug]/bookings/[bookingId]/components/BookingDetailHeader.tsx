"use client";

import { Badge } from "@repo/ui/components/badge";
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

type BookingPhase =
	| "new"
	| "preparation"
	| "shooting"
	| "delivery"
	| "completed"
	| "cancelled";

interface BookingDetailHeaderProps {
	name: string;
	referenceNumber: string;
	status: BookingPhase;
	balance: string;
	backHref: string;
	onEdit?: () => void;
	onDuplicate?: () => void;
	onArchive?: () => void;
	onDelete?: () => void;
	className?: string;
}

const statusConfig: Record<
	BookingPhase,
	{ label: string; className: string }
> = {
	new: {
		label: "New",
		className: "bg-yellow-100 text-yellow-800 border-yellow-200",
	},
	preparation: {
		label: "Preparation",
		className: "bg-blue-100 text-blue-800 border-blue-200",
	},
	shooting: {
		label: "Shooting",
		className: "bg-purple-100 text-purple-800 border-purple-200",
	},
	delivery: {
		label: "Delivery",
		className: "bg-orange-100 text-orange-800 border-orange-200",
	},
	completed: {
		label: "Completed",
		className: "bg-green-100 text-green-800 border-green-200",
	},
	cancelled: {
		label: "Cancelled",
		className: "bg-gray-100 text-gray-800 border-gray-200",
	},
};

/**
 * Header component for booking detail page
 * Displays: back button, booking name, status badges, and actions dropdown
 */
export function BookingDetailHeader({
	name,
	referenceNumber,
	status,
	balance,
	backHref,
	onEdit,
	onDuplicate,
	onArchive,
	onDelete,
	className,
}: BookingDetailHeaderProps) {
	const statusInfo = statusConfig[status];
	const balanceNum = Number.parseFloat(balance) || 0;
	const isPaid = balanceNum <= 0;

	return (
		<div className={cn("flex items-center justify-between gap-4", className)}>
			{/* Left: Back button, name, badges */}
			<div className="flex items-center gap-3 min-w-0">
				<Link
					href={backHref}
					className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground shrink-0"
				>
					<ChevronLeftIcon className="h-5 w-5" />
					<span className="sr-only">Back to bookings</span>
				</Link>

				<div className="min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<h1 className="text-lg font-semibold truncate">{name}</h1>
						<Badge
							variant="outline"
							className={cn("shrink-0", statusInfo.className)}
						>
							{statusInfo.label}
						</Badge>
						<Badge
							variant="outline"
							className={cn(
								"shrink-0",
								isPaid
									? "bg-green-100 text-green-800 border-green-200"
									: "bg-amber-100 text-amber-800 border-amber-200",
							)}
						>
							{isPaid ? "Paid" : "Unpaid"}
						</Badge>
					</div>
					<p className="text-sm text-muted-foreground">{referenceNumber}</p>
				</div>
			</div>

			{/* Right: Actions */}
			<div className="flex items-center gap-2 shrink-0">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm">
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
