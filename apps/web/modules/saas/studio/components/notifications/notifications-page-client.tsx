"use client";

import { Button } from "@repo/ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { PageContent } from "@saas/studio";
import { notificationsApi, notificationsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
	getNotificationEmptyStateCopy,
	getNotificationTypesForFilter,
	type NotificationTypeFilterValue,
	notificationTypeFilterOptions,
} from "./filters";
import { NotificationList, NotificationsPagination } from "./notification-list";

const PAGE_SIZE = 25;

export function NotificationsPageClient() {
	const { organizationSlug } = useParams<{ organizationSlug: string }>();
	const queryClient = useQueryClient();
	const [filter, setFilter] = useState<"all" | "unread">("all");
	const [typeFilter, setTypeFilter] =
		useState<NotificationTypeFilterValue>("all");
	const [page, setPage] = useState(1);

	const unreadOnly = filter === "unread";
	const filteredTypes = getNotificationTypesForFilter(typeFilter);
	const notificationsQuery = useQuery(
		notificationsApi.listOptions({
			page,
			limit: PAGE_SIZE,
			unreadOnly,
			types: filteredTypes,
		}),
	);

	const unreadCountQuery = useQuery(notificationsApi.unreadCountOptions());

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

	const markUnreadMutation = useMutation({
		...notificationsMutations.markUnread(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.notifications.key(),
			});
		},
	});

	const data = notificationsQuery.data?.data ?? [];
	const pagination = notificationsQuery.data?.pagination ?? {
		page,
		limit: PAGE_SIZE,
		total: 0,
		pageCount: 0,
	};
	const unreadCount = unreadCountQuery.data?.count ?? 0;
	const emptyState = getNotificationEmptyStateCopy(filter, typeFilter);

	const handleNotificationClick = async (
		notification: (typeof data)[number],
	) => {
		if (!notification.readAt) {
			await markReadMutation.mutateAsync({
				id: notification.id,
			});
		}
	};

	const handleToggleReadState = async (
		notification: (typeof data)[number],
	) => {
		if (notification.readAt) {
			await markUnreadMutation.mutateAsync({
				id: notification.id,
			});
			return;
		}

		await markReadMutation.mutateAsync({
			id: notification.id,
		});
	};

	const headerContent = (
		<div>
			<Tabs
				value={filter}
				onValueChange={(value) => {
					setFilter(value as "all" | "unread");
					setPage(1);
				}}
			>
				<TabsList>
					<TabsTrigger value="all">All</TabsTrigger>
					<TabsTrigger value="unread">
						Unread
						{unreadCount > 0 ? ` (${unreadCount})` : ""}
					</TabsTrigger>
				</TabsList>
			</Tabs>
			<div className="mt-3 flex flex-wrap gap-2">
				{notificationTypeFilterOptions.map((option) => (
					<Button
						key={option.value}
						variant={
							typeFilter === option.value ? "default" : "outline"
						}
						size="sm"
						onClick={() => {
							setTypeFilter(option.value);
							setPage(1);
						}}
					>
						{option.label}
					</Button>
				))}
			</div>
		</div>
	);

	return (
		<PageContent
			title="Notifications"
			controls={
				<Button
					variant="outline"
					size="sm"
					onClick={() => markAllMutation.mutate(undefined)}
					disabled={markAllMutation.isPending || unreadCount === 0}
				>
					Mark all read
				</Button>
			}
			headerContent={headerContent}
		>
			<div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
				<NotificationList
					notifications={data}
					isLoading={notificationsQuery.isLoading}
					organizationSlug={organizationSlug}
					onNotificationClick={handleNotificationClick}
					onToggleReadState={handleToggleReadState}
					emptyState={emptyState}
				/>
				<NotificationsPagination
					page={pagination.page}
					pageCount={pagination.pageCount}
					total={pagination.total}
					isFetching={notificationsQuery.isFetching}
					onPageChange={setPage}
				/>
			</div>
		</PageContent>
	);
}
