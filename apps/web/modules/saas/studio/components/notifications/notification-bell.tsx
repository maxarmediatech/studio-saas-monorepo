"use client";

import type { NotificationItem } from "@repo/api/modules/studio/schemas/notification";
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
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { NotificationList } from "./notification-list";
import { getNotificationsPageHref } from "./routes";

interface NotificationBellProps {
	buttonClassName?: string;
	align?: "start" | "center" | "end";
}

interface NotificationPanelProps {
	unreadCount: number;
	notifications: NotificationItem[];
	isLoading: boolean;
	isMarkAllPending: boolean;
	organizationSlug?: string;
	onMarkAllRead: () => void;
	onMarkRead: (id: string) => Promise<unknown>;
	onClose: () => void;
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

export function NotificationMenuPanel({
	unreadCount,
	notifications,
	isLoading,
	isMarkAllPending,
	organizationSlug,
	onMarkAllRead,
	onMarkRead,
	onClose,
}: NotificationPanelProps) {
	const params = useParams<{ organizationSlug?: string }>();
	const resolvedOrganizationSlug =
		params.organizationSlug ?? organizationSlug;
	const notificationsPageHref = getNotificationsPageHref(
		resolvedOrganizationSlug,
	);

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
				<NotificationList
					notifications={notifications}
					isLoading={isLoading}
					organizationSlug={resolvedOrganizationSlug}
					onNotificationClick={async (notification) => {
						if (!notification.readAt) {
							await onMarkRead(notification.id);
						}
						onClose();
					}}
					emptyState={{
						title: "No notifications yet.",
					}}
				/>
			</div>
			<div className="border-t border-neutral-200 p-2">
				<Button
					asChild
					variant="ghost"
					size="sm"
					className="w-full justify-center"
				>
					<Link href={notificationsPageHref ?? "#"} onClick={onClose}>
						View all notifications
					</Link>
				</Button>
			</div>
		</>
	);
}

export function NotificationBell({
	buttonClassName,
	align = "end",
}: NotificationBellProps) {
	const params = useParams<{ organizationSlug?: string }>();
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
					organizationSlug={params.organizationSlug}
					onMarkAllRead={markAllRead}
					onMarkRead={markRead}
					onClose={() => setOpen(false)}
				/>
			</PopoverContent>
		</Popover>
	);
}
