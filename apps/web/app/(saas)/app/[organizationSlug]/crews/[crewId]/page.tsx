"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { formatMoney } from "@saas/shared/lib";
import { CrewCheckinsSection } from "@saas/studio/components/crew/crew-checkins-section";
import { useCrewParams } from "@saas/studio/hooks/params/use-crew-params";
import {
	crewsApi,
	deliverablesApi,
	shootsApi,
	tasksApi,
} from "@saas/studio/lib/api";
import { UserAvatar } from "@shared/components/UserAvatar";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	BriefcaseIcon,
	CalendarIcon,
	CameraIcon,
	CheckCircle2Icon,
	ChevronRight,
	CircleIcon,
	ClipboardListIcon,
	MailIcon,
	PackageIcon,
	PauseCircleIcon,
	PencilIcon,
	PhoneIcon,
	PlayCircleIcon,
	UsersIcon,
	WalletIcon,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const STATUS_STYLES: Record<string, string> = {
	active: "bg-green-500/10 text-green-600 border-green-500/20",
	inactive: "bg-gray-500/10 text-gray-600 border-gray-500/20",
	unavailable: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
};

const STATUS_LABELS: Record<string, string> = {
	active: "Active",
	inactive: "Inactive",
	unavailable: "Unavailable",
};

function formatRole(role: string): string {
	return role
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

function getTaskStatusIcon(status: string) {
	switch (status.toLowerCase()) {
		case "completed":
			return <CheckCircle2Icon className="size-4 text-green-600" />;
		case "in_progress":
			return <PlayCircleIcon className="size-4 text-blue-600" />;
		case "cancelled":
			return <XCircleIcon className="size-4 text-red-600" />;
		default:
			return <CircleIcon className="size-4 text-muted-foreground" />;
	}
}

function getDeliverableStatusIcon(status: string) {
	switch (status.toLowerCase()) {
		case "delivered":
		case "completed":
			return <CheckCircle2Icon className="size-4 text-green-600" />;
		case "in_progress":
			return <PlayCircleIcon className="size-4 text-blue-600" />;
		case "cancelled":
			return <XCircleIcon className="size-4 text-red-600" />;
		default:
			return <CircleIcon className="size-4 text-muted-foreground" />;
	}
}

function getShootStatusIcon(status: string) {
	switch (status.toLowerCase()) {
		case "completed":
			return <CheckCircle2Icon className="size-4 text-green-600" />;
		case "confirmed":
			return <CheckCircle2Icon className="size-4 text-blue-600" />;
		case "in_progress":
			return <PlayCircleIcon className="size-4 text-blue-600" />;
		case "cancelled":
			return <XCircleIcon className="size-4 text-red-600" />;
		case "postponed":
			return <PauseCircleIcon className="size-4 text-yellow-600" />;
		default:
			return <CircleIcon className="size-4 text-muted-foreground" />;
	}
}

export default function CrewDetailPage() {
	const params = useParams<{
		organizationSlug: string;
		crewId: string;
	}>();
	const { openEdit } = useCrewParams();

	const { data: crewData, isLoading: crewLoading } = useQuery(
		crewsApi.getOptions(params.crewId),
	);

	const crew = crewData?.data;

	const { data: tasksData, isLoading: tasksLoading } = useQuery({
		...tasksApi.listOptions({
			crewId: params.crewId,
			status: ["pending", "in_progress"],
			sortBy: "dueDate",
			sortDirection: "asc",
			limit: 50,
		}),
		enabled: !!params.crewId,
	});

	const { data: deliverablesData, isLoading: deliverablesLoading } = useQuery(
		{
			...deliverablesApi.listOptions({
				crewId: params.crewId,
				status: ["pending", "in_progress"],
				sortBy: "dueDate",
				sortDirection: "asc",
				limit: 50,
			}),
			enabled: !!params.crewId,
		},
	);

	const { data: shootsData, isLoading: shootsLoading } = useQuery({
		...shootsApi.listOptions({
			crewId: params.crewId,
			status: ["scheduled", "confirmed", "in_progress"],
			sortBy: "shootDate",
			sortDirection: "asc",
			limit: 50,
		}),
		enabled: !!params.crewId,
	});

	const tasks = tasksData?.data ?? [];
	const deliverables = deliverablesData?.data ?? [];
	const shoots = shootsData?.data ?? [];

	const crewsHref = `/app/${params.organizationSlug}/crews`;

	if (crewLoading) {
		return (
			<div className="mx-auto w-full max-w-[800px] py-6 px-4">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="mt-8 h-8 w-96" />
				<Skeleton className="mt-4 h-4 w-64" />
				<Skeleton className="mt-6 h-24 w-full" />
			</div>
		);
	}

	if (!crew) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-muted-foreground">
					Crew member not found
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[800px] py-6 px-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm">
					<Link
						href={crewsHref}
						className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
					>
						<UsersIcon className="size-4" />
						Crew
					</Link>
					<ChevronRight className="size-4 text-muted-foreground" />
					<span className="font-medium text-foreground truncate max-w-[300px]">
						{crew.name}
					</span>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => openEdit(crew.id)}
				>
					<PencilIcon className="mr-1 size-4" />
					Edit
				</Button>
			</div>

			<div className="mt-8">
				<div className="flex items-start gap-4">
					<UserAvatar name={crew.name} className="size-16" />
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-3">
							<h1 className="text-2xl font-semibold">
								{crew.name}
							</h1>
							<Badge
								className={
									STATUS_STYLES[crew.status] ??
									"bg-gray-500/10"
								}
							>
								{STATUS_LABELS[crew.status] ?? crew.status}
							</Badge>
						</div>
						<div className="mt-1 flex items-center gap-2 text-muted-foreground">
							<BriefcaseIcon className="size-4" />
							<span>{formatRole(crew.role)}</span>
							{crew.dailyRate && (
								<>
									<span>·</span>
									<WalletIcon className="size-4" />
									<span>
										{formatMoney(crew.dailyRate)}/day
									</span>
								</>
							)}
						</div>
						<div className="mt-3 flex flex-wrap gap-4 text-sm">
							{crew.email && (
								<a
									href={`mailto:${crew.email}`}
									className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
								>
									<MailIcon className="size-4" />
									{crew.email}
								</a>
							)}
							{crew.phoneNumber && (
								<a
									href={`tel:${crew.phoneNumber}`}
									className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
								>
									<PhoneIcon className="size-4" />
									{crew.phoneNumber}
								</a>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="mt-8 border-t pt-6">
				<h2 className="font-semibold flex items-center gap-2">
					<CameraIcon className="size-4" />
					Upcoming Shoots ({shoots.length})
				</h2>

				{shootsLoading ? (
					<div className="mt-4 space-y-3">
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
					</div>
				) : shoots.length > 0 ? (
					<div className="mt-4 space-y-2">
						{shoots.map((shoot) => (
							<Link
								key={shoot.id}
								href={`/app/${params.organizationSlug}/shoots/${shoot.id}`}
								className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
							>
								<div className="flex items-center gap-3 min-w-0">
									{getShootStatusIcon(shoot.status)}
									<div className="min-w-0">
										<div className="font-medium truncate">
											{shoot.shootType
												.split("_")
												.map(
													(w) =>
														w
															.charAt(0)
															.toUpperCase() +
														w.slice(1),
												)
												.join(" ")}
										</div>
										<div className="text-xs text-muted-foreground">
											{shoot.bookingName}
										</div>
									</div>
								</div>
								<div className="flex items-center gap-3 text-sm text-muted-foreground shrink-0">
									<span className="flex items-center gap-1">
										<CalendarIcon className="size-3" />
										{format(
											new Date(shoot.shootDate),
											"MMM d",
										)}
									</span>
									<Badge
										variant="outline"
										className="text-xs"
									>
										{shoot.status}
									</Badge>
								</div>
							</Link>
						))}
					</div>
				) : (
					<div className="mt-4 text-sm text-muted-foreground">
						No upcoming shoots assigned.
					</div>
				)}
			</div>

			<div className="mt-8 border-t pt-6">
				<h2 className="font-semibold flex items-center gap-2">
					<ClipboardListIcon className="size-4" />
					Active Tasks ({tasks.length})
				</h2>

				{tasksLoading ? (
					<div className="mt-4 space-y-3">
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
					</div>
				) : tasks.length > 0 ? (
					<div className="mt-4 space-y-2">
						{tasks.map((task) => (
							<Link
								key={task.id}
								href={`/app/${params.organizationSlug}/tasks/${task.id}`}
								className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
							>
								<div className="flex items-center gap-3 min-w-0">
									{getTaskStatusIcon(task.status)}
									<div className="min-w-0">
										<div className="font-medium truncate">
											{task.name}
										</div>
										<div className="text-xs text-muted-foreground">
											{task.bookingName}
										</div>
									</div>
								</div>
								<div className="flex items-center gap-3 text-sm text-muted-foreground shrink-0">
									{task.dueDate && (
										<span className="flex items-center gap-1">
											<CalendarIcon className="size-3" />
											{format(
												new Date(task.dueDate),
												"MMM d",
											)}
										</span>
									)}
									<Badge
										variant="outline"
										className="text-xs"
									>
										{task.priority}
									</Badge>
								</div>
							</Link>
						))}
					</div>
				) : (
					<div className="mt-4 text-sm text-muted-foreground">
						No active tasks assigned.
					</div>
				)}
			</div>

			<div className="mt-8 border-t pt-6">
				<h2 className="font-semibold flex items-center gap-2">
					<PackageIcon className="size-4" />
					Active Deliverables ({deliverables.length})
				</h2>

				{deliverablesLoading ? (
					<div className="mt-4 space-y-3">
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
					</div>
				) : deliverables.length > 0 ? (
					<div className="mt-4 space-y-2">
						{deliverables.map((deliverable) => (
							<Link
								key={deliverable.id}
								href={`/app/${params.organizationSlug}/deliverables/${deliverable.id}`}
								className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
							>
								<div className="flex items-center gap-3 min-w-0">
									{getDeliverableStatusIcon(
										deliverable.status,
									)}
									<div className="min-w-0">
										<div className="font-medium truncate">
											{deliverable.name}
										</div>
										<div className="text-xs text-muted-foreground">
											{deliverable.bookingName}
										</div>
									</div>
								</div>
								<div className="flex items-center gap-3 text-sm text-muted-foreground shrink-0">
									{deliverable.dueDate && (
										<span className="flex items-center gap-1">
											<CalendarIcon className="size-3" />
											{format(
												new Date(deliverable.dueDate),
												"MMM d",
											)}
										</span>
									)}
								</div>
							</Link>
						))}
					</div>
				) : (
					<div className="mt-4 text-sm text-muted-foreground">
						No active deliverables assigned.
					</div>
				)}
			</div>

			<CrewCheckinsSection
				userId={crew.userId}
				organizationSlug={params.organizationSlug}
			/>
		</div>
	);
}
