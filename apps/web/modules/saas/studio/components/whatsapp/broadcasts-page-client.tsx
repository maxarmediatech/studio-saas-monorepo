"use client";

import type { campaignItemSchema } from "@repo/api/modules/whatsapp/types";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import {
	DataTable,
	DataTableColumnHeader,
	DataTableViewOptions,
} from "@saas/shared/components/data-table";
import "@saas/shared/components/data-table/types";
import { whatsappApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { MailIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { z } from "zod";

type Campaign = z.infer<typeof campaignItemSchema>;
type CampaignStatus =
	| "all"
	| "draft"
	| "scheduled"
	| "running"
	| "paused"
	| "completed"
	| "cancelled";

const ALL_STATUS = "all";

function formatDate(value: Date | null) {
	if (!value) {
		return "—";
	}

	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(value);
}

function getTiming(campaign: Campaign) {
	if (campaign.status === "scheduled") {
		return `Scheduled ${formatDate(campaign.scheduledAt)}`;
	}

	if (campaign.completedAt) {
		return `Completed ${formatDate(campaign.completedAt)}`;
	}

	if (campaign.startedAt) {
		return `Started ${formatDate(campaign.startedAt)}`;
	}

	return `Created ${formatDate(campaign.createdAt)}`;
}

function getStatusVariant(status: Campaign["status"]) {
	if (status === "completed") {
		return "default";
	}

	if (status === "cancelled" || status === "paused") {
		return "destructive";
	}

	return "outline";
}

export function WhatsAppBroadcastsPageClient() {
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<CampaignStatus>(ALL_STATUS);

	const campaignsQuery = useQuery({
		...whatsappApi.listCampaignsOptions({
			...(search.trim() ? { search: search.trim() } : {}),
			...(status !== ALL_STATUS ? { status } : {}),
		}),
		refetchOnWindowFocus: false,
	});

	const campaigns = campaignsQuery.data?.data ?? [];
	const hasActiveFilters = Boolean(search.trim()) || status !== ALL_STATUS;

	const columns: ColumnDef<Campaign>[] = useMemo(
		() => [
			{
				id: "name",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Broadcast" />
				),
				cell: ({ row }) => (
					<div>
						<p className="m-0 font-medium text-foreground">
							{row.original.name}
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							{row.original.description ||
								row.original.templateName ||
								row.original.messageType}
						</p>
					</div>
				),
				meta: {
					label: "Broadcast",
					width: 280,
					minWidth: 220,
					headerClassName:
						"!border-r-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[0.5px] after:bg-table-border-subtle",
					cellClassName:
						"!border-r-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[0.5px] after:bg-table-border-subtle",
				},
				enableSorting: false,
				enableHiding: false,
			},
			{
				id: "status",
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => (
					<Badge variant={getStatusVariant(row.original.status)}>
						{row.original.status}
					</Badge>
				),
				meta: { label: "Status", width: 130, minWidth: 120 },
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "template",
				accessorKey: "templateName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Template" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{row.original.templateName ?? "—"}
					</span>
				),
				meta: { label: "Template", width: 180, minWidth: 150 },
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "audience",
				accessorKey: "estimatedRecipients",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Audience" />
				),
				cell: ({ row }) => (
					<span>{row.original.estimatedRecipients}</span>
				),
				meta: { label: "Audience", width: 120, minWidth: 110 },
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "delivery",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Delivery" />
				),
				cell: ({ row }) => (
					<div className="text-muted-foreground text-xs">
						<span className="text-foreground">
							{row.original.totalSent}
						</span>{" "}
						sent ·{" "}
						<span className="text-foreground">
							{row.original.totalDelivered}
						</span>{" "}
						delivered ·{" "}
						<span className="text-foreground">
							{row.original.totalRead}
						</span>{" "}
						read ·{" "}
						<span className="text-foreground">
							{row.original.totalFailed}
						</span>{" "}
						failed
					</div>
				),
				meta: { label: "Delivery", width: 280, minWidth: 240 },
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "timing",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Timing" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{getTiming(row.original)}
					</span>
				),
				meta: { label: "Timing", width: 180, minWidth: 160 },
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "actions",
				header: ({ table }) => <DataTableViewOptions table={table} />,
				cell: () => null,
				enableSorting: false,
				enableHiding: false,
				meta: {
					width: 48,
					minWidth: 48,
					headerClassName:
						"!px-0 md:sticky md:right-0 bg-gray-100 z-10",
					cellClassName:
						"!px-0 md:sticky md:right-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10",
				},
			},
		],
		[],
	);

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
				<div className="relative w-full max-w-sm">
					<SearchIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search broadcasts..."
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						className="pl-9"
					/>
				</div>
				<Select
					value={status}
					onValueChange={(value) =>
						setStatus(value as CampaignStatus)
					}
				>
					<SelectTrigger className="h-9 w-[160px]">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="draft">Draft</SelectItem>
						<SelectItem value="scheduled">Scheduled</SelectItem>
						<SelectItem value="running">Running</SelectItem>
						<SelectItem value="paused">Paused</SelectItem>
						<SelectItem value="completed">Completed</SelectItem>
						<SelectItem value="cancelled">Cancelled</SelectItem>
					</SelectContent>
				</Select>
				{hasActiveFilters ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => {
							setSearch("");
							setStatus(ALL_STATUS);
						}}
					>
						Reset
					</Button>
				) : null}
				<Button type="button" className="lg:ml-auto" disabled>
					<PlusIcon className="mr-1.5 size-4" />
					New Broadcast
				</Button>
			</div>

			<DataTable
				columns={columns}
				data={campaigns}
				isLoading={campaignsQuery.isLoading}
				isFetching={campaignsQuery.isFetching}
				getRowId={(row) => row.id}
				stickyLeftColumns={[{ id: "name", width: 280 }]}
				stickyRightColumns={[{ id: "actions", width: 48 }]}
				minWidth={1180}
				scrollControlsColumnId="name"
				scrollStartColumn={1}
				emptyState={
					<div className="flex flex-col items-center gap-2">
						<MailIcon className="h-12 w-12 text-muted-foreground/50" />
						<p className="text-muted-foreground">
							No broadcasts yet
						</p>
					</div>
				}
			/>
		</div>
	);
}
