"use client";

import type { NotificationItem } from "@repo/api/modules/studio/schemas/notification";
import { Button } from "@repo/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";
import {
	configurationsApi,
	notificationsApi,
	notificationsMutations,
} from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
	getNotificationBodyText,
	type NotificationStatusLabelMaps,
} from "./content";
import { getNotificationEntityHref } from "./routes";

interface NotificationBellProps {
	buttonClassName?: string;
	align?: "start" | "center" | "end";
}

interface NotificationPanelProps {
	unreadCount: number;
	notifications: NotificationItem[];
	isLoading: boolean;
	isMarkAllPending: boolean;
	onMarkAllRead: () => void;
	onMarkRead: (id: string) => Promise<unknown>;
	onClose: () => void;
}

function formatTimestamp(value: string) {
	const date = new Date(value);
	return date.toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

export function useNotificationMenuState(enabled = true) {
	const queryClient = useQueryClient();

	const { data: countData } = useQuery({
		...notificationsApi.unreadCountOptions(),
		enabled,
	});
	const { data: listData, isLoading } = useQuery({
		...notificationsApi.listOptions({
			page: 1,
			limit: 5,
			unreadOnly: false,
		}),
		enabled,
	});

	const unreadCount = countData?.count ?? 0;
	const notifications = listData?.data ?? [];

	const markAllMutation = useMutation({
		...notificationsMutations.markAllRead(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.notifications.key(),
			});
		},
	});

	const markReadMutation = useMutation({
		...notificationsMutations.markRead(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.notifications.key(),
			});
		},
	});

	const badgeLabel = useMemo(() => {
		if (unreadCount <= 0) {
			return null;
		}
		return unreadCount > 99 ? "99+" : String(unreadCount);
	}, [unreadCount]);

	return {
		unreadCount,
		notifications,
		isLoading,
		badgeLabel,
		isMarkAllPending: markAllMutation.isPending,
		markAllRead: () => markAllMutation.mutate(undefined),
		markRead: (id: string) => markReadMutation.mutateAsync({ id }),
	};
}

function useNotificationStatusLabelMaps() {
	const [taskStatusQuery, deliverableStatusQuery, shootStatusQuery] =
		useQueries({
			queries: [
				configurationsApi.taskStatusOptions(),
				configurationsApi.deliverableStatusOptions(),
				configurationsApi.shootStatusOptions(),
			],
		});

	return useMemo<NotificationStatusLabelMaps>(() => {
		const taskStatusLabels: Record<string, string> = {};
		const deliverableStatusLabels: Record<string, string> = {};
		const shootStatusLabels: Record<string, string> = {};

		for (const config of taskStatusQuery.data?.data ?? []) {
			taskStatusLabels[config.key] = config.label;
		}

		for (const config of deliverableStatusQuery.data?.data ?? []) {
			deliverableStatusLabels[config.key] = config.label;
		}

		for (const config of shootStatusQuery.data?.data ?? []) {
			shootStatusLabels[config.key] = config.label;
		}

		return {
			task_status: taskStatusLabels,
			deliverable_status: deliverableStatusLabels,
			shoot_status: shootStatusLabels,
		};
	}, [
		deliverableStatusQuery.data?.data,
		shootStatusQuery.data?.data,
		taskStatusQuery.data?.data,
	]);
}

export function NotificationMenuPanel({
	unreadCount,
	notifications,
	isLoading,
	isMarkAllPending,
	onMarkAllRead,
	onMarkRead,
	onClose,
}: NotificationPanelProps) {
	const params = useParams<{ organizationSlug?: string }>();
	const router = useRouter();
	const statusLabelMaps = useNotificationStatusLabelMaps();
	const organizationSlug = params.organizationSlug;

	return (
		<>
			<div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
				<span className="text-sm font-medium text-neutral-900">
					Notifications
				</span>
				<Button
					variant="ghost"
					size="sm"
					onClick={onMarkAllRead}
					disabled={isMarkAllPending || unreadCount === 0}
				>
					Mark all read
				</Button>
			</div>
			<div className="max-h-80 overflow-auto">
				{isLoading ? (
					<div className="p-4 text-sm text-neutral-500">
						Loading notifications...
					</div>
				) : notifications.length === 0 ? (
					<div className="p-4 text-sm text-neutral-500">
						No notifications yet.
					</div>
				) : (
					notifications.map((notification) => {
						const isUnread = !notification.readAt;
						const href = getNotificationEntityHref(
							organizationSlug,
							notification,
						);
						const bodyText = getNotificationBodyText(
							notification,
							statusLabelMaps,
						);
						return (
							<button
								key={notification.id}
								type="button"
								disabled={!href}
								className={cn(
									"flex w-full flex-col gap-1 border-b border-neutral-100 px-3 py-2 text-left text-sm",
									isUnread ? "bg-neutral-50" : "bg-white",
									!href && "cursor-default opacity-70",
								)}
								onClick={() => {
									if (!href) {
										return;
									}

									if (isUnread) {
										void onMarkRead(notification.id);
									}
									onClose();
									router.push(href);
								}}
							>
								<div className="flex items-center justify-between gap-2">
									<span className="font-medium text-neutral-900">
										{notification.title}
									</span>
									{isUnread ? (
										<span className="h-2 w-2 rounded-full bg-blue-500" />
									) : null}
								</div>
								{bodyText ? (
									<span className="text-xs text-neutral-500">
										{bodyText}
									</span>
								) : null}
								<span className="text-xs text-neutral-400">
									{formatTimestamp(notification.createdAt)}
								</span>
							</button>
						);
					})
				)}
			</div>
		</>
	);
}

export function NotificationBell({
	buttonClassName,
	align = "end",
}: NotificationBellProps) {
	const [open, setOpen] = useState(false);
	const {
		unreadCount,
		notifications,
		isLoading,
		badgeLabel,
		isMarkAllPending,
		markAllRead,
		markRead,
	} = useNotificationMenuState();

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className={cn("relative size-9", buttonClassName)}
					aria-label="Notifications"
				>
					<Bell className="size-5" />
					{badgeLabel && (
						<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
							{badgeLabel}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align={align} className="w-80 p-0">
				<NotificationMenuPanel
					unreadCount={unreadCount}
					notifications={notifications}
					isLoading={isLoading}
					isMarkAllPending={isMarkAllPending}
					onMarkAllRead={markAllRead}
					onMarkRead={markRead}
					onClose={() => setOpen(false)}
				/>
			</PopoverContent>
		</Popover>
	);
}
