"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { formatMoney } from "@saas/shared/lib";
import { useStudioCapabilities } from "@saas/studio/components/studio-capabilities-context";
import { useShootParams } from "@saas/studio/hooks/params/use-shoot-params";
import { shootsApi } from "@saas/studio/lib/api";
import { getEventSideLabel } from "@saas/studio/lib/event-side";
import { getShootExtraServiceLabel } from "@saas/studio/lib/shoot-planning";
import { UserAvatar } from "@shared/components/UserAvatar";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	CalendarIcon,
	CameraIcon,
	CheckCircleIcon,
	ChevronRight,
	CircleIcon,
	ClockIcon,
	MapPinIcon,
	PauseCircleIcon,
	PencilIcon,
	PhoneIcon,
	PlayCircleIcon,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const STATUS_VARIANTS: Record<
	string,
	"default" | "secondary" | "outline" | "destructive"
> = {
	scheduled: "outline",
	confirmed: "secondary",
	in_progress: "default",
	completed: "default",
	cancelled: "destructive",
	postponed: "outline",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
	scheduled: CircleIcon,
	confirmed: CheckCircleIcon,
	in_progress: PlayCircleIcon,
	completed: CheckCircleIcon,
	cancelled: XCircleIcon,
	postponed: PauseCircleIcon,
};

const STATUS_LABELS: Record<string, string> = {
	scheduled: "Scheduled",
	confirmed: "Confirmed",
	in_progress: "In Progress",
	completed: "Completed",
	cancelled: "Cancelled",
	postponed: "Postponed",
};

function formatShootType(type: string): string {
	return type
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

function getStatusBadge(status: string) {
	const StatusIcon = STATUS_ICONS[status] ?? CircleIcon;
	return (
		<Badge variant={STATUS_VARIANTS[status] ?? "outline"}>
			<StatusIcon className="mr-1 h-3 w-3" />
			{STATUS_LABELS[status] ?? status}
		</Badge>
	);
}

export default function ShootDetailPage() {
	const params = useParams<{
		organizationSlug: string;
		shootId: string;
	}>();
	const { bookingReadOrList, shootReadOrList } = useStudioCapabilities();
	const { openEdit } = useShootParams();

	const { data: shootData, isLoading } = useQuery(
		shootsApi.getOptions(params.shootId),
	);

	const shoot = shootData?.data;

	const shootsHref = `/app/${params.organizationSlug}/shoots`;

	if (isLoading) {
		return (
			<div className="mx-auto w-full max-w-[800px] py-6 px-4">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="mt-8 h-8 w-96" />
				<Skeleton className="mt-4 h-4 w-64" />
				<Skeleton className="mt-6 h-24 w-full" />
			</div>
		);
	}

	if (!shoot) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-muted-foreground">Shoot not found</div>
			</div>
		);
	}

	const booking = shoot.booking;

	return (
		<div className="mx-auto w-full max-w-[800px] py-6 px-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm">
					{shootReadOrList ? (
						<Link
							href={shootsHref}
							className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
						>
							<CameraIcon className="size-4" />
							Shoots
						</Link>
					) : (
						<span className="flex items-center gap-1 text-muted-foreground">
							<CameraIcon className="size-4" />
							Shoots
						</span>
					)}
					<ChevronRight className="size-4 text-muted-foreground" />
					<span className="font-medium text-foreground truncate max-w-[300px]">
						{formatShootType(shoot.shootType)}
					</span>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => openEdit(shoot.id)}
				>
					<PencilIcon className="mr-1 size-4" />
					Edit
				</Button>
			</div>

			<div className="mt-8">
				<div className="flex items-center gap-3">
					<h1 className="text-2xl font-semibold">
						{formatShootType(shoot.shootType)}
					</h1>
					{getStatusBadge(shoot.status)}
					{shoot.side && (
						<Badge variant="secondary">
							{getEventSideLabel(shoot.side)}
						</Badge>
					)}
				</div>

				<div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
					<span>for</span>
					{bookingReadOrList ? (
						<Link
							href={`/app/${params.organizationSlug}/bookings/${booking.id}`}
							className="font-medium text-foreground hover:underline"
						>
							{booking.name}
						</Link>
					) : (
						<span className="font-medium text-foreground">
							{booking.name}
						</span>
					)}
					<span className="text-xs">({booking.referenceNumber})</span>
				</div>

				<div className="mt-6 space-y-3">
					{shoot.bookingEvent && (
						<div className="flex items-center gap-3 text-sm">
							<CameraIcon className="size-4 text-muted-foreground" />
							<span>
								Linked booking event:{" "}
								{shoot.bookingEvent.eventType}
							</span>
						</div>
					)}
					<div className="flex items-center gap-3 text-sm">
						<CalendarIcon className="size-4 text-muted-foreground" />
						<span className="font-medium">
							{format(
								new Date(shoot.shootDate),
								"EEEE, MMMM d, yyyy",
							)}
						</span>
					</div>

					{(shoot.startTime || shoot.endTime) && (
						<div className="flex items-center gap-3 text-sm">
							<ClockIcon className="size-4 text-muted-foreground" />
							<span>
								{shoot.startTime}
								{shoot.endTime && ` - ${shoot.endTime}`}
							</span>
						</div>
					)}

					{(shoot.venue || shoot.venueAddress) && (
						<div className="flex items-start gap-3 text-sm">
							<MapPinIcon className="size-4 text-muted-foreground mt-0.5" />
							<div>
								{shoot.venue && (
									<div className="font-medium">
										{shoot.venue}
									</div>
								)}
								{shoot.venueAddress && (
									<div className="text-muted-foreground">
										{shoot.venueAddress}
									</div>
								)}
							</div>
						</div>
					)}

					{shoot.requiredCrewCount && (
						<div className="flex items-center gap-3 text-sm">
							<CameraIcon className="size-4 text-muted-foreground" />
							<span>
								Assigned {shoot.assignments?.length ?? 0} /
								Required {shoot.requiredCrewCount}
							</span>
						</div>
					)}
				</div>

				{shoot.notes && (
					<div className="mt-6">
						<h3 className="text-sm font-medium text-muted-foreground mb-2">
							Notes
						</h3>
						<p className="text-foreground whitespace-pre-wrap">
							{shoot.notes}
						</p>
					</div>
				)}

				{shoot.additionalServices.length > 0 && (
					<div className="mt-6">
						<h3 className="text-sm font-medium text-muted-foreground mb-2">
							Extra Services
						</h3>
						<div className="flex flex-wrap gap-2">
							{shoot.additionalServices.map((service) => (
								<Badge key={service} variant="outline">
									{getShootExtraServiceLabel(service)}
								</Badge>
							))}
						</div>
					</div>
				)}
			</div>

			<div className="mt-8 border-t pt-6">
				<h2 className="font-semibold">
					Crew ({shoot.assignments?.length ?? 0})
				</h2>

				{shoot.assignments && shoot.assignments.length > 0 ? (
					<div className="mt-4 space-y-3">
						{shoot.assignments.map((assignment) => (
							<div
								key={assignment.id}
								className="flex items-center justify-between p-4 rounded-lg border bg-card"
							>
								<div className="flex items-center gap-3">
									<UserAvatar
										name={assignment.crew.name}
										className="size-10"
									/>
									<div>
										<div className="flex items-center gap-2">
											<span className="font-medium">
												{assignment.crew.name}
											</span>
											{assignment.isLead && (
												<Badge
													variant="outline"
													className="text-xs text-primary border-primary/50"
												>
													Lead
												</Badge>
											)}
										</div>
										<div className="text-sm text-muted-foreground">
											{assignment.role}
										</div>
									</div>
								</div>
								<div className="flex items-center gap-4">
									{assignment.rate && (
										<span className="text-sm font-medium">
											{formatMoney(assignment.rate)}
										</span>
									)}
									{assignment.crew.phoneNumber && (
										<a
											href={`tel:${assignment.crew.phoneNumber}`}
											className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
										>
											<PhoneIcon className="size-4" />
											{assignment.crew.phoneNumber}
										</a>
									)}
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="mt-4 text-sm text-muted-foreground py-4">
						No crew assigned to this shoot yet.
					</div>
				)}
			</div>
		</div>
	);
}
