"use client";

import type { YourWorkItem } from "@repo/api/modules/studio/schemas/your-work";
import { Badge } from "@repo/ui/components/badge";
import {
	DataTable,
	type PaginationState,
} from "@saas/shared/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Camera, ListTodoIcon, Package } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { getYourWorkEntityHref } from "./routes";
import { SubscribeButton } from "./subscribe-button";

interface YourWorkTableProps {
	organizationSlug: string;
	data: Array<YourWorkItem & { groupLabel?: string; rowKey?: string }>;
	isLoading: boolean;
	isFetching: boolean;
	pagination?: PaginationState;
	onPaginationChange?: (pagination: PaginationState) => void;
	showGroup?: boolean;
}

function formatDate(dateString: string | null): string {
	if (!dateString) {
		return "-";
	}
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function getEntityLabel(entityType: YourWorkItem["entityType"]) {
	switch (entityType) {
		case "task":
			return "Task";
		case "deliverable":
			return "Deliverable";
		case "shoot":
			return "Shoot";
		default:
			return "Item";
	}
}

function getEntityIcon(entityType: YourWorkItem["entityType"]) {
	switch (entityType) {
		case "task":
			return <ListTodoIcon className="size-4" />;
		case "deliverable":
			return <Package className="size-4" />;
		case "shoot":
			return <Camera className="size-4" />;
		default:
			return null;
	}
}

function getStatusBadge(status: string | null) {
	if (!status) {
		return <Badge variant="outline">-</Badge>;
	}
	return <Badge variant="secondary">{status}</Badge>;
}

export function YourWorkTable({
	organizationSlug,
	data,
	isLoading,
	isFetching,
	pagination,
	onPaginationChange,
	showGroup,
}: YourWorkTableProps) {
	const columns = useMemo<
		ColumnDef<YourWorkItem & { groupLabel?: string; rowKey?: string }>[]
	>(() => {
		const base: ColumnDef<
			YourWorkItem & { groupLabel?: string; rowKey?: string }
		>[] = [
			{
				id: "type",
				header: "Type",
				cell: ({ row }) => (
					<div className="flex items-center gap-2 text-sm text-neutral-700">
						<span className="text-neutral-500">
							{getEntityIcon(row.original.entityType)}
						</span>
						{getEntityLabel(row.original.entityType)}
					</div>
				),
			},
			{
				id: "name",
				header: "Name",
				cell: ({ row }) => (
					<Link
						href={getYourWorkEntityHref(
							organizationSlug,
							row.original,
						)}
						className="text-sm font-medium text-neutral-900 hover:underline"
					>
						{row.original.name}
					</Link>
				),
			},
			{
				id: "booking",
				header: "Booking",
				cell: ({ row }) => (
					<span className="text-sm text-neutral-600">
						{row.original.bookingName ?? "-"}
					</span>
				),
			},
			{
				id: "status",
				header: "Status",
				cell: ({ row }) => getStatusBadge(row.original.status),
			},
			{
				id: "date",
				header: "Date",
				cell: ({ row }) => (
					<span className="text-sm text-neutral-600">
						{formatDate(row.original.date)}
					</span>
				),
			},
			{
				id: "subscribe",
				header: "Watch",
				cell: ({ row }) => (
					<SubscribeButton
						entityType={row.original.entityType}
						entityId={row.original.entityId}
						isSubscribed={row.original.isSubscribed}
					/>
				),
			},
		];

		if (showGroup) {
			base.unshift({
				id: "group",
				header: "List",
				cell: ({ row }) => (
					<span className="text-sm text-neutral-600">
						{row.original.groupLabel ?? "-"}
					</span>
				),
			});
		}

		return base;
	}, [organizationSlug, showGroup]);

	return (
		<DataTable
			columns={columns}
			data={data}
			isLoading={isLoading}
			isFetching={isFetching}
			pagination={pagination}
			onPaginationChange={onPaginationChange}
			getRowId={(row) => row.rowKey ?? row.id}
			emptyState={
				<div className="flex flex-col items-center gap-2 py-10 text-sm text-neutral-500">
					<span className="font-medium text-neutral-700">
						No work items yet
					</span>
					<span>
						Assignments and subscriptions will show up here.
					</span>
				</div>
			}
		/>
	);
}
