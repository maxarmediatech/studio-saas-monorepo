"use client";

import type { automationItemSchema } from "@repo/api/modules/whatsapp/types";
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
import { whatsappApi, whatsappMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { PlusIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { AutomationCreateSheet } from "./automation-create-sheet";

type Automation = z.infer<typeof automationItemSchema>;
type AutomationStatus = "all" | "draft" | "published" | "archived";

const ALL_STATUS = "all";

function formatDate(value: Date | null) {
	if (!value) {
		return "-";
	}

	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(value);
}

function actionSummary(automation: Automation) {
	return automation.flowData.actions
		.map((action) => action.type.replaceAll("_", " "))
		.join(" -> ");
}

function triggerSummary(automation: Automation) {
	if (automation.triggerType === "first_inbound") {
		return "First inbound message";
	}

	return automation.triggerKeywords.length
		? automation.triggerKeywords.join(", ")
		: "No keywords";
}

function getStatusVariant(status: Automation["status"]) {
	if (status === "published") {
		return "default";
	}

	if (status === "archived") {
		return "destructive";
	}

	return "outline";
}

export function WhatsAppAutomationsPageClient() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<AutomationStatus>(ALL_STATUS);
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	const automationsQuery = useQuery({
		...whatsappApi.listAutomationsOptions({
			...(search.trim() ? { search: search.trim() } : {}),
			...(status !== ALL_STATUS ? { status } : {}),
		}),
		refetchOnWindowFocus: false,
	});

	const statusMutation = useMutation({
		...whatsappMutations.updateAutomationStatus(),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({
				queryKey: orpc.whatsapp.key(),
			});
			toast.success(result.message);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update automation");
		},
	});

	const automations = automationsQuery.data?.data ?? [];
	const hasActiveFilters = Boolean(search.trim()) || status !== ALL_STATUS;

	const columns: ColumnDef<Automation>[] = useMemo(
		() => [
			{
				id: "name",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Automation" />
				),
				cell: ({ row }) => (
					<div>
						<p className="m-0 font-medium text-foreground">
							{row.original.name}
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							{row.original.description ||
								actionSummary(row.original)}
						</p>
					</div>
				),
				meta: {
					label: "Automation",
					width: 300,
					minWidth: 240,
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
				id: "trigger",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Trigger" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{triggerSummary(row.original)}
					</span>
				),
				meta: { label: "Trigger", width: 240, minWidth: 200 },
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "actions",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Actions" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{row.original.flowData.actions.length}
					</span>
				),
				meta: { label: "Actions", width: 100, minWidth: 90 },
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "triggered",
				accessorKey: "totalTriggered",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Triggered" />
				),
				cell: ({ row }) => <span>{row.original.totalTriggered}</span>,
				meta: { label: "Triggered", width: 120, minWidth: 110 },
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "lastTriggered",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Last Trigger"
					/>
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{formatDate(row.original.lastTriggeredAt)}
					</span>
				),
				meta: { label: "Last Trigger", width: 160, minWidth: 140 },
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "quickStatus",
				header: ({ table }) => <DataTableViewOptions table={table} />,
				cell: ({ row }) => (
					<Select
						value={row.original.status}
						onValueChange={(nextStatus) =>
							statusMutation.mutate({
								automationId: row.original.id,
								status: nextStatus as Automation["status"],
							})
						}
					>
						<SelectTrigger className="h-8 w-[120px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							<SelectItem value="draft">Draft</SelectItem>
							<SelectItem value="published">Published</SelectItem>
							<SelectItem value="archived">Archived</SelectItem>
						</SelectContent>
					</Select>
				),
				enableSorting: false,
				enableHiding: false,
				meta: {
					width: 148,
					minWidth: 148,
					headerClassName:
						"!px-0 md:sticky md:right-0 bg-gray-100 z-10",
					cellClassName:
						"!px-3 md:sticky md:right-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10",
				},
			},
		],
		[statusMutation],
	);

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
				<div className="relative w-full max-w-sm">
					<SearchIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search automations..."
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						className="pl-9"
					/>
				</div>
				<Select
					value={status}
					onValueChange={(value) =>
						setStatus(value as AutomationStatus)
					}
				>
					<SelectTrigger className="h-9 w-[160px]">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="draft">Draft</SelectItem>
						<SelectItem value="published">Published</SelectItem>
						<SelectItem value="archived">Archived</SelectItem>
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
				<Button
					type="button"
					className="lg:ml-auto"
					onClick={() => setIsCreateOpen(true)}
				>
					<PlusIcon className="mr-1.5 size-4" />
					New Automation
				</Button>
			</div>
			<DataTable
				columns={columns}
				data={automations}
				isLoading={automationsQuery.isLoading}
				isFetching={automationsQuery.isFetching}
				getRowId={(row) => row.id}
				stickyLeftColumns={[{ id: "name", width: 300 }]}
				stickyRightColumns={[{ id: "quickStatus", width: 148 }]}
				minWidth={1200}
				scrollControlsColumnId="name"
				scrollStartColumn={1}
				emptyState={
					<div className="flex flex-col items-center gap-2">
						<SparklesIcon className="h-12 w-12 text-muted-foreground/50" />
						<p className="text-muted-foreground">
							No automations yet
						</p>
					</div>
				}
			/>
			<AutomationCreateSheet
				open={isCreateOpen}
				onOpenChange={setIsCreateOpen}
			/>
		</div>
	);
}
