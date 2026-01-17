"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { bookingsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
	CameraIcon,
	CheckSquareIcon,
	MailIcon,
	PackageIcon,
	PhoneIcon,
	UsersIcon,
} from "lucide-react";

type CrewsCardProps = {
	bookingId: string;
};

type AssignmentSource = {
	type: "shoot" | "task" | "deliverable";
	id: string;
	name: string;
};

type CrewMember = {
	id: string;
	name: string;
	role: string;
	phoneNumber: string | null;
	email: string | null;
	assignments: AssignmentSource[];
};

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function AssignmentBadge({ source }: { source: AssignmentSource }) {
	const icons = {
		shoot: <CameraIcon className="h-3 w-3" />,
		task: <CheckSquareIcon className="h-3 w-3" />,
		deliverable: <PackageIcon className="h-3 w-3" />,
	};

	const variants = {
		shoot: "secondary" as const,
		task: "outline" as const,
		deliverable: "outline" as const,
	};

	return (
		<Badge
			variant={variants[source.type]}
			className="gap-1 text-[10px] px-1.5 py-0"
		>
			{icons[source.type]}
			<span className="truncate max-w-[80px]">{source.name}</span>
		</Badge>
	);
}

function CrewRow({ crew }: { crew: CrewMember }) {
	// Group assignments by type for cleaner display
	const groupedAssignments = crew.assignments.reduce(
		(acc, assignment) => {
			if (!acc[assignment.type]) {
				acc[assignment.type] = [];
			}
			acc[assignment.type].push(assignment);
			return acc;
		},
		{} as Record<string, AssignmentSource[]>,
	);

	// Show max 3 assignment badges
	const allAssignments = crew.assignments.slice(0, 3);
	const remainingCount = crew.assignments.length - 3;

	return (
		<div className="flex items-start gap-3 py-2">
			<Avatar className="h-8 w-8 shrink-0">
				<AvatarFallback className="text-xs">
					{getInitials(crew.name)}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1 space-y-1">
				<div className="flex items-center gap-2">
					<p className="text-sm font-medium truncate">{crew.name}</p>
					<span className="text-xs text-muted-foreground">
						{crew.role}
					</span>
				</div>
				{crew.phoneNumber && (
					<a
						href={`tel:${crew.phoneNumber}`}
						className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						<PhoneIcon className="h-3 w-3" />
						<span className="truncate">{crew.phoneNumber}</span>
					</a>
				)}
				{crew.email && (
					<a
						href={`mailto:${crew.email}`}
						className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						<MailIcon className="h-3 w-3" />
						<span className="truncate">{crew.email}</span>
					</a>
				)}
				{/* Assignment badges */}
				<div className="flex flex-wrap gap-1 pt-1">
					{allAssignments.map((assignment) => (
						<AssignmentBadge
							key={`${assignment.type}-${assignment.id}`}
							source={assignment}
						/>
					))}
					{remainingCount > 0 && (
						<Badge variant="outline" className="text-[10px] px-1.5 py-0">
							+{remainingCount} more
						</Badge>
					)}
				</div>
			</div>
		</div>
	);
}

function EmptyState() {
	return (
		<div className="flex flex-col items-center gap-2 py-6 text-center">
			<UsersIcon className="h-6 w-6 text-muted-foreground/30" />
			<p className="text-xs text-muted-foreground">No crew assigned</p>
		</div>
	);
}

function LoadingState() {
	return (
		<div className="space-y-3">
			<div className="flex items-start gap-3">
				<Skeleton className="h-8 w-8 rounded-full" />
				<div className="flex-1 space-y-2">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-3 w-32" />
				</div>
			</div>
			<div className="flex items-start gap-3">
				<Skeleton className="h-8 w-8 rounded-full" />
				<div className="flex-1 space-y-2">
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-3 w-36" />
				</div>
			</div>
		</div>
	);
}

export function CrewsCard({ bookingId }: CrewsCardProps) {
	const { data, isLoading } = useQuery({
		...bookingsApi.listCrewsOptions(bookingId),
		enabled: !!bookingId,
	});

	const crews = data?.data ?? [];
	const hasCrews = crews.length > 0;

	return (
		<Card className="shadow-none rounded-lg">
			<CardHeader>
				<CardTitle className="text-base">Crew</CardTitle>
				<CardDescription>Team members on this booking.</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<LoadingState />
				) : hasCrews ? (
					<div className="divide-y">
						{crews.map((crew) => (
							<CrewRow key={crew.id} crew={crew} />
						))}
					</div>
				) : (
					<EmptyState />
				)}
			</CardContent>
		</Card>
	);
}
