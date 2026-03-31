"use client";

import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Progress } from "@repo/ui/components/progress";
import { deliverablesApi, shootsApi } from "@saas/studio/lib/api";
import { getShootExtraServiceLabel } from "@saas/studio/lib/shoot-planning";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CheckCircle2Icon } from "lucide-react";
import { formatCurrency, getStatusVariant } from "../utils";
import { FinancesTab } from "./FinancesTab";
import { TasksTab } from "./TasksTab";

interface OverviewTabEnhancedProps {
	bookingId: string;
	booking: {
		name: string;
		status: string;
		packageCost: string;
		totalReceived: string;
		note?: string | null;
		guestCount?: number | null;
		participants?: Array<{
			client?: {
				id: string;
				name: string;
				email?: string | null;
			} | null;
		}>;
	};
}

type ShootData = {
	id: string;
	name?: string | null;
	shootType?: string | null;
	shootDate?: string | null;
	startTime?: string | null;
	endTime?: string | null;
	requiredCrewCount?: number | null;
	assignmentsCount?: number;
	additionalServices?: string[];
	status: string;
};

// Default scope items - can be populated from booking.note or future API
const defaultScope = {
	inScope: [
		"Coverage as per package",
		"Standard editing and color grading",
		"Digital delivery",
	],
	outOfScope: [
		"Printed albums",
		"Additional revisions beyond package",
		"Raw footage delivery",
	],
};

// Default outcomes - can be populated from future API
const defaultOutcomes = [
	"Deliver highlight content on schedule",
	"Share preview gallery within agreed timeline",
	"Capture all key moments as discussed",
];

// Default priorities - can be populated from future API
const defaultPriorities = {
	p0: ["Core coverage"],
	p1: ["Creative shots"],
	p2: ["Detail shots"],
};

function BookingSummaryCard({
	booking,
	shootsCount,
	deliverablesTotal,
}: {
	booking: OverviewTabEnhancedProps["booking"];
	shootsCount: number;
	deliverablesTotal: number;
}) {
	const packageCostNum = Number.parseFloat(booking.packageCost) || 0;
	const totalReceivedNum = Number.parseFloat(booking.totalReceived) || 0;

	const receivedProgress =
		packageCostNum > 0
			? Math.round((totalReceivedNum / packageCostNum) * 100)
			: 0;

	const stats = [
		{
			label: "Package value",
			value: formatCurrency(booking.packageCost),
		},
		{
			label: "Collected",
			value: formatCurrency(booking.totalReceived),
		},
		{
			label: booking.guestCount ? "Guests" : "Shoots",
			value: booking.guestCount?.toString() || shootsCount.toString(),
		},
		{
			label: "Deliverables",
			value: deliverablesTotal.toString(),
		},
	];

	return (
		<Card className="rounded-lg">
			<CardHeader>
				<CardTitle className="text-base">Booking summary</CardTitle>
				<CardDescription>
					High-level signals and coverage context.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{stats.map((stat) => (
						<div
							key={stat.label}
							className="rounded-lg border bg-muted/20 p-3"
						>
							<p className="text-xs text-muted-foreground">
								{stat.label}
							</p>
							<p className="mt-1 text-lg font-semibold">
								{stat.value}
							</p>
						</div>
					))}
				</div>
				<div className="mt-4">
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<span>Payment health</span>
						<span>{receivedProgress}%</span>
					</div>
					<Progress value={receivedProgress} className="mt-2" />
				</div>
			</CardContent>
		</Card>
	);
}

function _CoverageScopeCard() {
	return (
		<Card className="rounded-lg">
			<CardHeader>
				<CardTitle className="text-base">Coverage scope</CardTitle>
				<CardDescription>
					What is included and excluded.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6 sm:grid-cols-2">
				<div>
					<p className="text-sm font-medium">In scope</p>
					<ul className="mt-2 space-y-1 text-sm text-muted-foreground">
						{defaultScope.inScope.map((item) => (
							<li key={item}>• {item}</li>
						))}
					</ul>
				</div>
				<div>
					<p className="text-sm font-medium">Out of scope</p>
					<ul className="mt-2 space-y-1 text-sm text-muted-foreground">
						{defaultScope.outOfScope.map((item) => (
							<li key={item}>• {item}</li>
						))}
					</ul>
				</div>
			</CardContent>
		</Card>
	);
}

function _ExpectedOutcomesCard() {
	return (
		<Card className="rounded-lg">
			<CardHeader>
				<CardTitle className="text-base">Expected outcomes</CardTitle>
				<CardDescription>
					Delivery goals for the booking.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2 text-sm text-muted-foreground">
				{defaultOutcomes.map((item) => (
					<div key={item} className="flex items-start gap-2">
						<CheckCircle2Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
						<span>{item}</span>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

function _KeyPrioritiesCard() {
	return (
		<Card className="rounded-lg">
			<CardHeader>
				<CardTitle className="text-base">Key priorities</CardTitle>
				<CardDescription>Primary focus areas by phase.</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4 sm:grid-cols-3">
				<div className="space-y-2">
					<p className="text-xs font-semibold text-muted-foreground">
						P0
					</p>
					{defaultPriorities.p0.map((item) => (
						<p key={item} className="text-sm">
							{item}
						</p>
					))}
				</div>
				<div className="space-y-2">
					<p className="text-xs font-semibold text-muted-foreground">
						P1
					</p>
					{defaultPriorities.p1.map((item) => (
						<p key={item} className="text-sm">
							{item}
						</p>
					))}
				</div>
				<div className="space-y-2">
					<p className="text-xs font-semibold text-muted-foreground">
						P2
					</p>
					{defaultPriorities.p2.map((item) => (
						<p key={item} className="text-sm">
							{item}
						</p>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function UpcomingShootsCard({ shoots }: { shoots: ShootData[] }) {
	if (shoots.length === 0) {
		return (
			<Card className="rounded-lg">
				<CardHeader>
					<CardTitle className="text-base">Upcoming shoots</CardTitle>
					<CardDescription>
						Shoot plan and readiness status.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No shoots scheduled yet.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="rounded-lg">
			<CardHeader>
				<CardTitle className="text-base">Upcoming shoots</CardTitle>
				<CardDescription>
					Shoot plan and readiness status.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{shoots.slice(0, 5).map((session) => {
					const dateStr = session.shootDate
						? format(parseISO(session.shootDate), "MMM d, yyyy")
						: "Date TBD";

					const timeStr =
						session.startTime && session.endTime
							? `${format(new Date(`2000-01-01T${session.startTime}`), "h:mm a")} - ${format(new Date(`2000-01-01T${session.endTime}`), "h:mm a")}`
							: "";

					return (
						<div
							key={session.id}
							className="flex items-center justify-between rounded-lg border bg-muted/10 px-3 py-2"
						>
							<div>
								<p className="text-sm font-medium">
									{session.name ||
										session.shootType ||
										"Session"}
								</p>
								<p className="text-xs text-muted-foreground">
									{dateStr}
									{timeStr && ` - ${timeStr}`}
								</p>
								{(session.requiredCrewCount ||
									(session.additionalServices?.length ?? 0) >
										0) && (
									<div className="mt-1 flex flex-wrap gap-1">
										{session.requiredCrewCount ? (
											<Badge
												variant="outline"
												className="text-[10px]"
											>
												Assigned{" "}
												{session.assignmentsCount ?? 0}{" "}
												/ {session.requiredCrewCount}
											</Badge>
										) : null}
										{session.additionalServices?.map(
											(service) => (
												<Badge
													key={service}
													variant="outline"
													className="text-[10px]"
												>
													{getShootExtraServiceLabel(
														service,
													)}
												</Badge>
											),
										)}
									</div>
								)}
							</div>
							<Badge
								variant={getStatusVariant(session.status)}
								className="capitalize"
							>
								{session.status.replace("_", " ")}
							</Badge>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}

export function OverviewTabEnhanced({
	bookingId,
	booking,
}: OverviewTabEnhancedProps) {
	const { data: shootsData } = useQuery({
		...shootsApi.listOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const { data: deliverablesData } = useQuery({
		...deliverablesApi.listOptions({ bookingId, limit: 100 }),
		enabled: !!bookingId,
	});

	const shoots = shootsData?.data ?? [];
	const deliverables = deliverablesData?.data ?? [];

	return (
		<div className="space-y-6">
			<BookingSummaryCard
				booking={booking}
				shootsCount={shoots.length}
				deliverablesTotal={deliverables.length}
			/>
			<UpcomingShootsCard shoots={shoots} />
			<TasksTab bookingId={bookingId} />
			<FinancesTab bookingId={bookingId} />
		</div>
	);
}
