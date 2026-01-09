"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import {
	deliverablesApi,
	shootsApi,
} from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
	CheckCircle2,
	Mail,
	Phone,
	User,
} from "lucide-react";
import { formatCurrency, formatPackageType } from "../utils";

// ============================================================================
// Types
// ============================================================================

interface OverviewTabProps {
	bookingId: string;
	booking: {
		name: string;
		status: string;
		packageCost: string;
		packageType?: string | null;
		totalReceived: string;
		balance: string;
		note?: string | null;
		participants?: Array<{
			client?: {
				id: string;
				name: string;
				email?: string | null;
				phone?: string | null;
			} | null;
		}>;
	};
}

interface MilestoneProps {
	label: string;
	isComplete: boolean;
}

interface ShootData {
	id: string;
	status: string;
}

interface DeliverableData {
	id: string;
	status: string;
}

// ============================================================================
// Sub-Components
// ============================================================================

function Milestone({ label, isComplete }: MilestoneProps) {
	return (
		<div className="flex flex-col gap-3 w-full">
			<div className="flex items-center gap-2 min-h-[20px]">
				{isComplete && (
					<CheckCircle2 className="size-4 text-foreground" />
				)}
				<span
					className={cn(
						"text-sm font-medium transition-colors",
						isComplete ? "text-foreground" : "text-muted-foreground/80",
					)}
				>
					{label}
				</span>
			</div>
			<div
				className={cn(
					"h-1 w-full rounded-full transition-all duration-300",
					isComplete ? "bg-foreground" : "bg-muted/80",
				)}
			/>
		</div>
	);
}

function MilestoneTracker({
	packageCost,
	packageType,
	totalReceived,
	shoots,
	deliverables,
}: {
	packageCost: string;
	packageType?: string | null;
	totalReceived: string;
	shoots: ShootData[];
	deliverables: DeliverableData[];
}) {
	const packageCostNum = Number.parseFloat(packageCost) || 0;
	const totalReceivedNum = Number.parseFloat(totalReceived) || 0;

	const hasAdvancePayment = totalReceivedNum > 0;
	const shootsCompleted =
		shoots.length > 0 && shoots.every((s) => s.status === "completed");
	const deliverablesCompleted =
		deliverables.length > 0 &&
		deliverables.every((d) => d.status === "completed");
	const isFullyPaid = totalReceivedNum >= packageCostNum && packageCostNum > 0;

	return (
		<div className="overflow-hidden rounded-xl border bg-background">
			<div className="bg-muted/60 px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs border-b">
				<div className="flex items-center gap-2 text-muted-foreground">
					<span>Package Type</span>
					<span className="font-medium text-foreground">
						{formatPackageType(packageType)}
					</span>
				</div>
				<div className="text-muted-foreground">
					Package Cost:{" "}
					<span className="font-medium text-foreground">
						{formatCurrency(packageCost)}
					</span>
				</div>
			</div>

			<div className="p-8">
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
					<Milestone label="Advance Payment" isComplete={hasAdvancePayment} />
					<Milestone label="Shoot Completed" isComplete={shootsCompleted} />
					<Milestone label="Deliverables Complete" isComplete={deliverablesCompleted} />
					<Milestone label="Payment Completed" isComplete={isFullyPaid} />
				</div>
			</div>
		</div>
	);
}

function ClientsSection({
	participants,
}: {
	participants?: OverviewTabProps["booking"]["participants"];
}) {
	const clients =
		participants
			?.map((p) => p.client)
			.filter(
				(c): c is NonNullable<typeof c> => c !== null && c !== undefined,
			) ?? [];

	if (clients.length === 0) {
		return (
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Clients</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No clients associated with this booking.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Clients</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{clients.map((client) => (
						<div
							key={client.id}
							className="flex items-start gap-3 p-3 rounded-lg border bg-background"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
								<User className="h-5 w-5 text-muted-foreground" />
							</div>
							<div className="flex-1 space-y-1">
								<p className="text-sm font-medium">{client.name}</p>
								{client.email && (
									<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
										<Mail className="h-3 w-3" />
										<span>{client.email}</span>
									</div>
								)}
								{client.phone && (
									<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
										<Phone className="h-3 w-3" />
										<span>{client.phone}</span>
									</div>
								)}
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function QuickStats({
	packageCost,
	balance,
	shoots,
	deliverables,
}: {
	packageCost: string;
	balance: string;
	shoots: ShootData[];
	deliverables: DeliverableData[];
}) {
	const shootsCompleted = shoots.filter((s) => s.status === "completed").length;
	const deliverablesCompleted = deliverables.filter(
		(d) => d.status === "completed",
	).length;
	const balanceNum = Number.parseFloat(balance) || 0;

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Quick Stats</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Shoots</p>
						<p className="text-lg font-semibold">
							{shootsCompleted}/{shoots.length}
							<span className="text-sm font-normal text-muted-foreground ml-1">
								completed
							</span>
						</p>
					</div>
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Deliverables</p>
						<p className="text-lg font-semibold">
							{deliverablesCompleted}/{deliverables.length}
							<span className="text-sm font-normal text-muted-foreground ml-1">
								completed
							</span>
						</p>
					</div>
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Package Cost</p>
						<p className="text-lg font-semibold">
							{formatCurrency(packageCost)}
						</p>
					</div>
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Balance</p>
						<p
							className={cn(
								"text-lg font-semibold",
								balanceNum > 0 ? "text-amber-600" : "text-green-600",
							)}
						>
							{formatCurrency(balance)}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function NotesSection({ note }: { note?: string | null }) {
	if (!note) return null;

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Notes</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-muted-foreground whitespace-pre-wrap">
					{note}
				</p>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// Main Component
// ============================================================================

export function OverviewTab({ bookingId, booking }: OverviewTabProps) {
	// Single data fetch for shoots and deliverables - shared across sub-components
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
			<MilestoneTracker
				packageCost={booking.packageCost}
				packageType={booking.packageType}
				totalReceived={booking.totalReceived}
				shoots={shoots}
				deliverables={deliverables}
			/>

			<div className="grid md:grid-cols-2 gap-6">
				<QuickStats
					packageCost={booking.packageCost}
					balance={booking.balance}
					shoots={shoots}
					deliverables={deliverables}
				/>
				<ClientsSection participants={booking.participants} />
			</div>

			<NotesSection note={booking.note} />
		</div>
	);
}
