"use client";

import type { WhatsAppDashboard } from "@repo/api/modules/studio/schemas/dashboard";
import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
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

interface WhatsAppSummaryProps {
	data: WhatsAppDashboard;
	organizationSlug: string;
}

function formatResponseTime(minutes: number | null) {
	if (minutes === null) {
		return "—";
	}

	if (minutes < 60) {
		return `${minutes}m`;
	}

	return `${Math.round(minutes / 60)}h`;
}

function formatActivityDate(value: string) {
	return formatDistanceToNow(parseISO(value), { addSuffix: true });
}

export function WhatsAppSummary({
	data,
	organizationSlug,
}: WhatsAppSummaryProps) {
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
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 font-semibold text-base">
						<MessageCircleIcon className="size-4 text-emerald-600" />
						WhatsApp
					</CardTitle>
					<Link
						href={`/app/${organizationSlug}/messages`}
						className="font-medium text-primary text-sm hover:underline"
					>
						Open inbox
					</Link>
				</div>
			</CardHeader>
			<CardContent className="space-y-5 pb-4">
				<div className="grid gap-3 md:grid-cols-4">
					{stats.map((stat) => {
						const Icon = stat.icon;
						return (
							<div
								key={stat.label}
								className="rounded-lg border p-3"
							>
								<div className="mb-2 flex items-center justify-between">
									<p className="text-muted-foreground text-xs">
										{stat.label}
									</p>
									<Icon className="size-4 text-muted-foreground" />
								</div>
								<p className="font-semibold text-xl">
									{stat.value}
								</p>
							</div>
						);
					})}
				</div>

				<div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
					<div className="rounded-lg border p-4">
						<div className="mb-3 flex items-center justify-between">
							<div>
								<p className="font-medium text-sm">
									Campaign performance
								</p>
								<p className="text-muted-foreground text-xs">
									{data.campaigns.totalRecipients} recipients
									in range
								</p>
							</div>
							<Badge variant="outline">
								{data.messages.failed} failed
							</Badge>
						</div>
						<div className="grid grid-cols-3 gap-3 text-sm">
							<div>
								<p className="text-muted-foreground text-xs">
									Running
								</p>
								<p className="font-medium">
									{data.campaigns.running}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground text-xs">
									Scheduled
								</p>
								<p className="font-medium">
									{data.campaigns.scheduled}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground text-xs">
									Completed
								</p>
								<p className="font-medium">
									{data.campaigns.completed}
								</p>
							</div>
						</div>
					</div>

					<div className="rounded-lg border p-4">
						<div className="mb-3 flex items-center justify-between">
							<p className="font-medium text-sm">
								Top active contacts
							</p>
							<UsersIcon className="size-4 text-muted-foreground" />
						</div>
						{data.topContacts.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								No WhatsApp contact activity yet
							</p>
						) : (
							<div className="space-y-2">
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
					</div>
				</div>

				<div className="rounded-lg border">
					<div className="flex items-center justify-between border-b px-4 py-3">
						<p className="font-medium text-sm">
							Recent WhatsApp activity
						</p>
						<Link
							href={`/app/${organizationSlug}/messages/broadcasts`}
							className="flex items-center gap-1 font-medium text-primary text-sm hover:underline"
						>
							Broadcasts
							<ArrowRightIcon className="size-3.5" />
						</Link>
					</div>
					{data.recentActivity.length === 0 ? (
						<p className="px-4 py-6 text-muted-foreground text-sm">
							No recent WhatsApp activity
						</p>
					) : (
						<div className="divide-y">
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
											{formatActivityDate(
												activity.createdAt,
											)}
										</p>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
