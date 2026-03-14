"use client";

import { Button } from "@repo/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";
import { notificationsApi, notificationsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useMemo } from "react";

interface NotificationBellProps {
	buttonClassName?: string;
	align?: "start" | "center" | "end";
}

interface NotificationPanelProps {
	unreadCount: number;
	notifications: Array<{
		id: string;
		title: string;
		body: string | null;
		readAt: string | null;
		createdAt: string;
	}>;
	isLoading: boolean;
	isMarkAllPending: boolean;
	onMarkAllRead: () => void;
	onMarkRead: (id: string) => void;
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
		markRead: (id: string) => markReadMutation.mutate({ id }),
	};
}

export function NotificationMenuPanel({
	unreadCount,
	notifications,
	isLoading,
	isMarkAllPending,
	onMarkAllRead,
	onMarkRead,
}: NotificationPanelProps) {
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
						return (
							<button
								key={notification.id}
								type="button"
								className={cn(
									"flex w-full flex-col gap-1 border-b border-neutral-100 px-3 py-2 text-left text-sm",
									isUnread ? "bg-neutral-50" : "bg-white",
								)}
								onClick={() => {
									if (isUnread) {
										onMarkRead(notification.id);
									}
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
								{notification.body ? (
									<span className="text-xs text-neutral-500">
										{notification.body}
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
		<Popover>
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
				/>
			</PopoverContent>
		</Popover>
	);
}
