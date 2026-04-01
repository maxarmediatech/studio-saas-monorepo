"use client";

import type { NotificationItem } from "@repo/api/modules/studio/schemas/notification";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { Mail, MailOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import {
	getNotificationBodyText,
	getNotificationTypeLabel,
	getNotificationTypeTone,
} from "./content";
import { getNotificationEntityHref } from "./routes";
import { useNotificationStatusLabelMaps } from "./status-labels";
import { formatNotificationTimestamp } from "./timestamp";

interface NotificationListProps {
	notifications: NotificationItem[];
	isLoading: boolean;
	organizationSlug?: string;
	onNotificationClick?: (
		notification: NotificationItem,
	) => void | Promise<void>;
	onToggleReadState?: (
		notification: NotificationItem,
	) => void | Promise<void>;
	emptyState?: {
		title: string;
		description?: string;
	};
}

export function NotificationList({
	notifications,
	isLoading,
	organizationSlug,
	onNotificationClick,
	onToggleReadState,
	emptyState = {
		title: "No notifications yet.",
	},
}: NotificationListProps) {
	const router = useRouter();
	const statusLabelMaps = useNotificationStatusLabelMaps();

	if (isLoading) {
		return (
			<div className="space-y-3 p-4">
				<Skeleton className="h-16 rounded-2xl" />
				<Skeleton className="h-16 rounded-2xl" />
				<Skeleton className="h-16 rounded-2xl" />
			</div>
		);
	}

	if (notifications.length === 0) {
		return (
			<div className="px-4 py-10 text-center">
				<div className="text-sm font-medium text-neutral-900">
					{emptyState.title}
				</div>
				{emptyState.description ? (
					<div className="mt-1 text-sm text-neutral-500">
						{emptyState.description}
					</div>
				) : null}
			</div>
		);
	}

	return (
		<div>
			{notifications.map((notification) => {
				const isUnread = !notification.readAt;
				const href = getNotificationEntityHref(
					organizationSlug,
					notification,
				);
				const bodyText = getNotificationBodyText(
					notification,
					statusLabelMaps,
				);
				const typeLabel = getNotificationTypeLabel(notification);
				const typeTone = getNotificationTypeTone(notification);

				return (
					<div
						key={notification.id}
						className={cn(
							"group flex items-start gap-2 border-b border-neutral-100 transition-colors hover:bg-neutral-50",
							isUnread ? "bg-neutral-50/80" : "bg-white",
							!href && "opacity-70 hover:bg-white",
						)}
					>
						<button
							type="button"
							disabled={!href}
							className={cn(
								"flex min-w-0 flex-1 flex-col gap-2 px-4 py-3 text-left",
								!href && "cursor-default",
							)}
							onClick={() => {
								if (!href) {
									return;
								}

								void onNotificationClick?.(notification);
								router.push(href);
							}}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="mb-1 flex items-center gap-2">
										<span
											className={cn(
												"inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
												typeTone,
											)}
										>
											{typeLabel}
										</span>
									</div>
									<div className="truncate font-medium text-sm text-neutral-900">
										{notification.title}
									</div>
									{notification.actorName ? (
										<div className="mt-1 text-xs text-neutral-500">
											by {notification.actorName}
										</div>
									) : null}
								</div>
								<div className="flex shrink-0 items-center gap-2">
									{isUnread ? (
										<span className="h-2 w-2 rounded-full bg-blue-500" />
									) : null}
									<span className="text-xs text-neutral-400">
										{formatNotificationTimestamp(
											notification.createdAt,
										)}
									</span>
								</div>
							</div>
							{bodyText ? (
								<div className="text-sm text-neutral-600">
									{bodyText}
								</div>
							) : null}
						</button>
						{onToggleReadState ? (
							<div className="pr-2 pt-2">
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-8 text-neutral-400 hover:text-neutral-700"
									aria-label={
										isUnread
											? "Mark notification as read"
											: "Mark notification as unread"
									}
									onClick={(event) => {
										event.preventDefault();
										event.stopPropagation();
										void onToggleReadState(notification);
									}}
								>
									{isUnread ? (
										<MailOpen className="size-4" />
									) : (
										<Mail className="size-4" />
									)}
								</Button>
							</div>
						) : null}
					</div>
				);
			})}
		</div>
	);
}

interface NotificationsPaginationProps {
	page: number;
	pageCount: number;
	total: number;
	isFetching: boolean;
	onPageChange: (page: number) => void;
}

export function NotificationsPagination({
	page,
	pageCount,
	total,
	isFetching,
	onPageChange,
}: NotificationsPaginationProps) {
	const canGoPrevious = page > 1;
	const canGoNext = page < pageCount;

	return (
		<div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3">
			<div className="text-sm text-neutral-500">
				{total} notification{total === 1 ? "" : "s"}
			</div>
			<div className="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={!canGoPrevious || isFetching}
					onClick={() => onPageChange(page - 1)}
				>
					Previous
				</Button>
				<div className="min-w-14 text-center text-sm text-neutral-500">
					{page}/{Math.max(pageCount, 1)}
				</div>
				<Button
					variant="outline"
					size="sm"
					disabled={!canGoNext || isFetching}
					onClick={() => onPageChange(page + 1)}
				>
					Next
				</Button>
			</div>
		</div>
	);
}
