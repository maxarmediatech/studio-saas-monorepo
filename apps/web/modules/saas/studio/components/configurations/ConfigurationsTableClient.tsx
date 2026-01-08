"use client";

import type { Configuration } from "@repo/api/modules/studio/schemas/configuration";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Badge } from "@repo/ui/components/badge";
import {
	DataTable,
	DataTableColumnHeader,
	DataTableRowActions,
	DataTableViewOptions,
	type RowAction,
	SortProvider,
} from "@saas/shared/components/data-table";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import {
	type ConfigType,
	useConfigurationsTable,
} from "@saas/studio/hooks/tables";
import {
	configurationsApi,
	configurationsMutations,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CheckIcon,
	Loader2Icon,
	PencilIcon,
	SettingsIcon,
	TrashIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OpenConfigurationCreateSheet } from "./OpenConfigurationSheet";

interface ConfigurationsTableClientProps {
	configType: ConfigType;
	/** Singular label (e.g., "Booking Type") */
	configTypeLabel: string;
	/** Plural label (e.g., "Booking Types") */
	configTypeLabelPlural: string;
}

export function ConfigurationsTableClient({
	configType,
	configTypeLabel,
	configTypeLabelPlural,
}: ConfigurationsTableClientProps) {
	const queryClient = useQueryClient();

	// Use the configurations table hook for URL-synced state
	const {
		filters,
		pagination,
		sorting,
		sortingState,
		onSortingChange,
		onPaginationChange,
		onLimitChange,
	} = useConfigurationsTable();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [configToDelete, setConfigToDelete] = useState<Configuration | null>(
		null,
	);

	// URL-based sheet params
	const { openEdit } = useConfigurationParams();

	// Build query input from hook state
	const queryInput = {
		type: configType,
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		sortBy: (sorting.sortBy ?? "sortOrder") as
			| "sortOrder"
			| "label"
			| "createdAt",
		sortDirection: sorting.sortDirection,
	};

	// Fetch configurations with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		configurationsApi.listOptions(queryInput),
	);

	const configurations = data?.data ?? [];
	const serverPagination = data?.pagination ?? {
		page: 1,
		limit: 50,
		total: 0,
		pageCount: 0,
	};

	// Delete mutation
	const deleteMutation = useMutation({
		...configurationsMutations.delete(),
		onSuccess: () => {
			toast.success(`${configTypeLabel} deleted successfully`);
			setDeleteDialogOpen(false);
			setConfigToDelete(null);
			queryClient.invalidateQueries({
				queryKey: ["studio", "configurations"],
			});
		},
		onError: (error) => {
			toast.error(
				error.message ||
					`Failed to delete ${configTypeLabel.toLowerCase()}`,
			);
		},
	});

	const handleOpenEdit = (config: Configuration) => {
		openEdit(config.id, configType);
	};

	// Define row actions
	const rowActions: RowAction<Configuration>[] = useMemo(
		() => [
			{
				label: "Edit",
				icon: <PencilIcon className="h-4 w-4" />,
				onClick: handleOpenEdit,
			},
			{
				label: "Delete",
				icon: <TrashIcon className="h-4 w-4" />,
				variant: "destructive",
				separator: true,
				onClick: (row) => {
					if (row.isSystem) {
						toast.error("Cannot delete system configurations");
						return;
					}
					setConfigToDelete(row);
					setDeleteDialogOpen(true);
				},
			},
		],
		[],
	);

	// Define columns
	const columns: ColumnDef<Configuration>[] = useMemo(
		() => [
			{
				id: "label",
				accessorKey: "label",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Label" />
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						{row.original.color && (
							<div
								className="h-4 w-4 rounded-full border"
								style={{ backgroundColor: row.original.color }}
							/>
						)}
						<div>
							<p className="font-medium">{row.original.label}</p>
							<p className="text-xs text-muted-foreground font-mono">
								{row.original.key}
							</p>
						</div>
					</div>
				),
				meta: {
					label: "Label",
					width: 220,
					minWidth: 220,
				},
				enableSorting: true,
				enableHiding: false,
			},
			{
				id: "description",
				accessorKey: "description",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Description" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground truncate max-w-[250px] block">
						{row.original.description || "-"}
					</span>
				),
				meta: {
					label: "Description",
					width: 250,
					minWidth: 200,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "sortOrder",
				accessorKey: "sortOrder",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Order"
						className="justify-center"
					/>
				),
				cell: ({ row }) => (
					<div className="text-center font-mono text-sm">
						{row.original.sortOrder}
					</div>
				),
				meta: {
					label: "Order",
					width: 80,
					minWidth: 80,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "isDefault",
				accessorKey: "isDefault",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Default"
						className="justify-center"
					/>
				),
				cell: ({ row }) => (
					<div className="flex justify-center">
						{row.original.isDefault && (
							<CheckIcon className="h-4 w-4 text-green-600" />
						)}
					</div>
				),
				meta: {
					label: "Default",
					width: 80,
					minWidth: 80,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "isSystem",
				accessorKey: "isSystem",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Type"
						className="justify-center"
					/>
				),
				cell: ({ row }) => (
					<div className="flex justify-center">
						<Badge
							variant={
								row.original.isSystem ? "secondary" : "outline"
							}
						>
							{row.original.isSystem ? "System" : "Custom"}
						</Badge>
					</div>
				),
				meta: {
					label: "Type",
					width: 100,
					minWidth: 100,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "actions",
				header: ({ table }) => <DataTableViewOptions table={table} />,
				cell: ({ row }) => (
					<DataTableRowActions
						row={row.original}
						actions={rowActions}
					/>
				),
				enableSorting: false,
				enableHiding: false,
				meta: {
					width: 56,
					minWidth: 56,
				},
			},
		],
		[rowActions],
	);

	return (
		<>
			{/* Table with sort context */}
			<SortProvider
				sortColumn={sorting.sortBy}
				sortDirection={sorting.sortDirection}
			>
				<DataTable
					columns={columns}
					data={configurations}
					isLoading={isLoading}
					isFetching={isFetching}
					pagination={serverPagination}
					onPaginationChange={onPaginationChange}
					onLimitChange={onLimitChange}
					sorting={sortingState}
					onSortingChange={onSortingChange}
					emptyState={
						<div className="flex flex-col items-center gap-2">
							<SettingsIcon className="h-12 w-12 text-muted-foreground/50" />
							<p className="text-muted-foreground">
								No {configTypeLabelPlural.toLowerCase()} found
							</p>
							<OpenConfigurationCreateSheet
								configurationType={configType}
								variant="outline"
								size="sm"
								label={`Add your first ${configTypeLabel.toLowerCase()}`}
							/>
						</div>
					}
				/>
			</SortProvider>

			{/* Delete confirmation dialog */}
			<AlertDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Delete {configTypeLabel.toLowerCase()}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "
							{configToDelete?.label}". This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (configToDelete) {
									deleteMutation.mutate({
										id: configToDelete.id,
									});
								}
							}}
							disabled={deleteMutation.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleteMutation.isPending && (
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
							)}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
