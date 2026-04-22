"use client";

import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useShootParams } from "@saas/studio/hooks/params";
import { shootsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	AlertCircleIcon,
	CameraIcon,
	MoreVertical,
	PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CrewAvatarStack } from "./CrewAvatarStack";

interface ShootsTabProps {
	bookingId: string;
}

type Shoot = {
	id: string;
	name?: string | null;
	shootType?: string | null;
	shootDate?: string | null;
	startTime?: string | null;
	endTime?: string | null;
	venue?: string | null;
	status: string;
	assignedCrew: Array<{
		id: string;
		name: string;
		avatarUrl?: string | null;
	}>;
};

const STATUS_STYLES: Record<string, string> = {
	scheduled: "text-gray-600 bg-gray-50 ring-gray-500/10",
	confirmed: "text-blue-700 bg-blue-50 ring-blue-600/20",
	in_progress: "text-indigo-700 bg-indigo-50 ring-indigo-600/20",
	completed: "text-green-700 bg-green-50 ring-green-600/20",
	cancelled: "text-red-700 bg-red-50 ring-red-600/20",
	postponed: "text-yellow-800 bg-yellow-50 ring-yellow-600/20",
};

function getStatusStyle(status: string) {
	return STATUS_STYLES[status] || "text-gray-600 bg-gray-50 ring-gray-500/10";
}

function ShootRow({
	shoot,
	detailHref,
	onEdit,
}: {
	shoot: Shoot;
	detailHref?: string;
	onEdit: (id: string) => void;
}) {
	const dateStr = shoot.shootDate
		? format(new Date(shoot.shootDate), "MMM d, yyyy")
		: "Date TBD";

	const timeStr =
		shoot.startTime && shoot.endTime
			? `${format(new Date(`2000-01-01T${shoot.startTime}`), "h:mm a")} - ${format(new Date(`2000-01-01T${shoot.endTime}`), "h:mm a")}`
			: "Time TBD";

	const venueStr = shoot.venue || "Venue TBD";

	return (
		<li className="flex items-center justify-between gap-x-6 py-5">
			<div className="min-w-0">
				<div className="flex items-start gap-x-3">
					<p className="text-sm/6 font-semibold text-foreground">
						{shoot.name || shoot.shootType || "Unnamed Shoot"}
					</p>
					<p
						className={cn(
							"mt-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium capitalize whitespace-nowrap ring-1 ring-inset",
							getStatusStyle(shoot.status),
						)}
					>
						{shoot.status.replace("_", " ")}
					</p>
				</div>
				<div className="mt-1 flex items-center gap-x-2 text-xs/5 text-muted-foreground">
					<p className="whitespace-nowrap">{dateStr}</p>
					<svg
						viewBox="0 0 2 2"
						className="size-0.5 fill-current"
						aria-hidden="true"
					>
						<circle cx={1} cy={1} r={1} />
					</svg>
					<p className="whitespace-nowrap">{timeStr}</p>
					<svg
						viewBox="0 0 2 2"
						className="size-0.5 fill-current"
						aria-hidden="true"
					>
						<circle cx={1} cy={1} r={1} />
					</svg>
					<p className="truncate">{venueStr}</p>
				</div>
			</div>
			<div className="flex flex-none items-center gap-x-4">
				<CrewAvatarStack crew={shoot.assignedCrew} />
				{detailHref ? (
					<Button
						variant="outline"
						size="sm"
						className="hidden sm:block"
						asChild
					>
						<Link
							href={detailHref}
							target="_blank"
							rel="noopener noreferrer"
						>
							Details
						</Link>
					</Button>
				) : (
					<Button
						variant="outline"
						size="sm"
						className="hidden sm:block"
						onClick={() => onEdit(shoot.id)}
					>
						Details
					</Button>
				)}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="-m-2.5 block p-2.5 text-muted-foreground hover:text-foreground"
						>
							<span className="sr-only">Open options</span>
							<MoreVertical className="size-5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => onEdit(shoot.id)}>
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => console.log("Delete", shoot.id)}
						>
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</li>
	);
}

export function ShootsTab({ bookingId }: ShootsTabProps) {
	const { openCreate, openEdit } = useShootParams();
	const { organizationSlug } = useParams<{ organizationSlug: string }>();

	const {
		data: shoots,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...shootsApi.listOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const shootsList = shoots?.data ?? [];

	if (isLoading) {
		return (
			<div className="space-y-3">
				<div className="flex justify-end">
					<Skeleton className="h-9 w-24" />
				</div>
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-12 w-full" />
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center gap-3 py-12 text-center">
				<AlertCircleIcon className="h-8 w-8 text-muted-foreground/50" />
				<p className="text-sm text-muted-foreground">
					Failed to load shoots
				</p>
				<Button variant="outline" size="sm" onClick={() => refetch()}>
					Try again
				</Button>
			</div>
		);
	}

	return (
		<Card className="rounded-lg">
			<CardHeader className="flex flex-row items-center justify-between space-y-0">
				<div className="space-y-1">
					<CardTitle className="text-base">Shoots</CardTitle>
					<CardDescription>
						All scheduled photo/video sessions.
					</CardDescription>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => openCreate()}
				>
					<PlusIcon className="h-4 w-4 mr-1.5" />
					Add Shoot
				</Button>
			</CardHeader>
			<CardContent>
				{shootsList.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-8 text-center">
						<CameraIcon className="h-8 w-8 text-muted-foreground/30" />
						<p className="text-sm text-muted-foreground">
							No shoots scheduled
						</p>
					</div>
				) : (
					<ul className="divide-y divide-border">
						{shootsList.map((shoot) => (
							<ShootRow
								key={shoot.id}
								shoot={shoot}
								detailHref={
									organizationSlug
										? `/app/${organizationSlug}/shoots/${shoot.id}`
										: undefined
								}
								onEdit={openEdit}
							/>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
