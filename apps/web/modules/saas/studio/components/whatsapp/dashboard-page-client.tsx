"use client";

import type { whatsappDashboardSchema } from "@repo/api/modules/whatsapp/types";
import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { whatsappApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
	ArrowDownLeftIcon,
	ArrowRightIcon,
	ArrowUpRightIcon,
	MessageCircleIcon,
	SendIcon,
	TimerIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import type { z } from "zod";

type WhatsAppDashboard = z.infer<typeof whatsappDashboardSchema>;

function formatResponseTime(minutes: number | null) {
	if (minutes === null) {
		return "-";
	}

	if (minutes < 60) {
		return `${minutes}m`;
	}

	return `${Math.round(minutes / 60)}h`;
}

function formatActivityDate(value: string) {
	return formatDistanceToNow(parseISO(value), { addSuffix: true });
}

function StatGrid({ data }: { data: WhatsAppDashboard }) {
	const stats = [
		{
			label: "Conversations today",
			value: data.conversationsToday,
			icon: MessageCircleIcon,
		},
		{
			label: "Sent",
			value: data.messages.sent,
			icon: SendIcon,
		},
		{
			label: "Delivered / read",
			value: `${data.messages.delivered} / ${data.messages.read}`,
			icon: ArrowUpRightIcon,
		},
		{
			label: "Avg response",
			value: formatResponseTime(data.responseTimeMinutes),
			icon: TimerIcon,
		},
	];

	return (
		<div className="grid gap-3 md:grid-cols-4">
			{stats.map((stat) => {
				const Icon = stat.icon;
				return (
					<Card key={stat.label}>
						<CardContent className="p-4">
							<div className="mb-2 flex items-center justify-between">
								<p className="text-muted-foreground text-xs">
									{stat.label}
								</p>
								<Icon className="size-4 text-muted-foreground" />
							</div>
							<p className="font-semibold text-2xl">
								{stat.value}
							</p>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}

function CampaignPerformance({ data }: { data: WhatsAppDashboard }) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="font-semibold text-base">
						Campaign performance
					</CardTitle>
					<Badge variant="outline">
						{data.messages.failed} failed
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4 pb-4">
				<p className="text-muted-foreground text-sm">
					{data.campaigns.totalRecipients} recipients in the last 30
					days
				</p>
				<div className="grid grid-cols-3 gap-3 text-sm">
					<div className="rounded-md border p-3">
						<p className="text-muted-foreground text-xs">Running</p>
						<p className="font-semibold text-lg">
							{data.campaigns.running}
						</p>
					</div>
					<div className="rounded-md border p-3">
						<p className="text-muted-foreground text-xs">
							Scheduled
						</p>
						<p className="font-semibold text-lg">
							{data.campaigns.scheduled}
						</p>
					</div>
					<div className="rounded-md border p-3">
						<p className="text-muted-foreground text-xs">
							Completed
						</p>
						<p className="font-semibold text-lg">
							{data.campaigns.completed}
						</p>
					</div>
				</div>
				<Link
					href="../broadcasts"
					className="inline-flex items-center gap-1 font-medium text-primary text-sm hover:underline"
				>
					View broadcasts
					<ArrowRightIcon className="size-3.5" />
				</Link>
			</CardContent>
		</Card>
	);
}

function TopContacts({ data }: { data: WhatsAppDashboard }) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center gap-2 font-semibold text-base">
					<UsersIcon className="size-4 text-muted-foreground" />
					Top active contacts
				</CardTitle>
			</CardHeader>
			<CardContent className="pb-4">
				{data.topContacts.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No WhatsApp contact activity yet
					</p>
				) : (
					<div className="space-y-3">
						{data.topContacts.map((contact) => (
							<div
								key={contact.id}
								className="flex items-center justify-between gap-3"
							>
								<div className="min-w-0">
									<p className="truncate font-medium text-sm">
										{contact.name}
									</p>
									<p className="text-muted-foreground text-xs">
										{contact.phoneNumber}
									</p>
								</div>
								<Badge variant="outline">
									{contact.messageCount}
								</Badge>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function RecentActivity({ data }: { data: WhatsAppDashboard }) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="font-semibold text-base">
					Recent WhatsApp activity
				</CardTitle>
			</CardHeader>
			<CardContent className="pb-4">
				{data.recentActivity.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No recent WhatsApp activity
					</p>
				) : (
					<div className="divide-y rounded-md border">
						{data.recentActivity.map((activity) => {
							const DirectionIcon =
								activity.direction === "inbound"
									? ArrowDownLeftIcon
									: ArrowUpRightIcon;
							return (
								<div
									key={activity.id}
									className="flex items-center gap-3 px-4 py-3"
								>
									<DirectionIcon className="size-4 text-muted-foreground" />
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<p className="truncate font-medium text-sm">
												{activity.contactName}
											</p>
											<Badge
												variant="secondary"
												className="text-xs"
											>
												{activity.status}
											</Badge>
										</div>
										<p className="truncate text-muted-foreground text-xs">
											{activity.preview}
										</p>
									</div>
									<p className="shrink-0 text-muted-foreground text-xs">
										{formatActivityDate(activity.createdAt)}
									</p>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export function WhatsAppDashboardPageClient() {
	const dashboardQuery = useQuery({
		...whatsappApi.getDashboardOptions(),
		staleTime: 60_000,
		refetchOnWindowFocus: true,
	});

	if (dashboardQuery.isLoading) {
		return (
			<div className="space-y-4">
				<div className="grid gap-3 md:grid-cols-4">
					{Array.from({ length: 4 }).map((_, index) => (
						<Skeleton key={index} className="h-24 rounded-lg" />
					))}
				</div>
				<Skeleton className="h-64 rounded-lg" />
			</div>
		);
	}

	const data = dashboardQuery.data?.data;

	if (!data) {
		return null;
	}

	return (
		<div className="space-y-4">
			<StatGrid data={data} />
			<div className="grid gap-4 lg:grid-cols-2">
				<CampaignPerformance data={data} />
				<TopContacts data={data} />
			</div>
			<RecentActivity data={data} />
		</div>
	);
}
