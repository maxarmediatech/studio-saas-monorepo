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
import { useConfigurationViewParams } from "@saas/studio/hooks/params/use-configuration-view-params";
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
	EyeIcon,
	EyeOffIcon,
	Loader2Icon,
	PencilIcon,
	PowerIcon,
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
	const { openView } = useConfigurationViewParams();

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

	// Fetch booking types for label resolution (package_type, event_type, relation_type tables)
	const { data: bookingTypesData } = useQuery(
		configurationsApi.bookingTypesOptions(),
	);
	const bookingTypes = bookingTypesData?.data ?? [];

	// Fetch relation types for label resolution (booking_type table → "Applicable Roles" column)
	const { data: relationTypesData } = useQuery(
		configurationsApi.relationTypesOptions(),
	);
	const relationTypes = relationTypesData?.data ?? [];

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

	// Toggle active mutation
	const toggleActiveMutation = useMutation({
		...configurationsMutations.update(),
		onSuccess: (_data, variables) => {
			const action = variables.isActive ? "activated" : "deactivated";
			toast.success(`${configTypeLabel} ${action} successfully`);
			queryClient.invalidateQueries({
				queryKey: ["studio", "configurations"],
			});
		},
		onError: (error) => {
			toast.error(
				error.message || `Failed to update ${configTypeLabel.toLowerCase()}`,
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
				label: "View details",
				icon: <EyeIcon className="h-4 w-4" />,
				onClick: (row) => openView(row.id),
			},
			{
				label: "Edit",
				icon: <PencilIcon className="h-4 w-4" />,
				onClick: handleOpenEdit,
			},
			{
				label: "Deactivate",
				icon: <EyeOffIcon className="h-4 w-4" />,
				show: (row) => row.isActive,
				onClick: (row) => {
					toggleActiveMutation.mutate({
						id: row.id,
						isActive: false,
					});
				},
			},
			{
				label: "Activate",
				icon: <PowerIcon className="h-4 w-4" />,
				show: (row) => !row.isActive,
				onClick: (row) => {
					toggleActiveMutation.mutate({
						id: row.id,
						isActive: true,
					});
				},
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
		[toggleActiveMutation, openView],
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
					<div className={`flex items-center gap-3 ${!row.original.isActive ? "opacity-50" : ""}`}>
						{row.original.color && (
							<div
								className="h-4 w-4 rounded-full border"
								style={{ backgroundColor: row.original.color }}
							/>
						)}
						<button
							type="button"
							className="text-left hover:underline focus-visible:outline-none focus-visible:underline"
							onClick={() => openView(row.original.id)}
						>
							<p className="font-medium">{row.original.label}</p>
							<p className="text-xs text-muted-foreground font-mono">
								{row.original.key}
							</p>
						</button>
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
			// Package-type-only columns: Default Cost & Booking Type
			...(configType === "package_type"
				? [
						{
							id: "defaultCost",
							accessorKey: "defaultCost",
							header: ({ column }: { column: unknown }) => (
								<DataTableColumnHeader column={column as never} title="Default Cost" />
							),
							cell: ({ row }: { row: { original: Configuration } }) => {
								const value = row.original.defaultCost;
								if (!value) return <span className="text-muted-foreground">-</span>;
								return (
									<span className="font-mono text-sm">
										{new Intl.NumberFormat("en-IN", {
											style: "currency",
											currency: "INR",
											maximumFractionDigits: 0,
										}).format(Number(value))}
									</span>
								);
							},
							meta: {
								label: "Default Cost",
								width: 120,
								minWidth: 120,
							},
							enableSorting: false,
							enableHiding: true,
						} satisfies ColumnDef<Configuration>,
						{
							id: "bookingTypeFilter",
							accessorKey: "bookingTypeFilter",
							header: ({ column }: { column: unknown }) => (
								<DataTableColumnHeader column={column as never} title="Booking Type" />
							),
							cell: ({ row }: { row: { original: Configuration } }) => {
								const key = row.original.bookingTypeFilter;
								if (!key) return <span className="text-muted-foreground">All</span>;
								const match = bookingTypes.find((bt) => bt.key === key);
								return <span>{match?.label ?? key}</span>;
							},
							meta: {
								label: "Booking Type",
								width: 130,
								minWidth: 130,
							},
							enableSorting: false,
							enableHiding: true,
						} satisfies ColumnDef<Configuration>,
					]
				: []),
			// Booking type → "Applicable Roles" column (resolves metadata.roles keys to labels)
			...(configType === "booking_type"
				? [
						{
							id: "applicableRoles",
							header: ({ column }: { column: unknown }) => (
								<DataTableColumnHeader column={column as never} title="Applicable Roles" />
							),
							cell: ({ row }: { row: { original: Configuration } }) => {
								const roles = (row.original.metadata as Record<string, unknown> | null)?.roles;
								if (!Array.isArray(roles) || roles.length === 0) {
									return <span className="text-muted-foreground">All roles</span>;
								}
								return (
									<div className="flex flex-wrap gap-1">
										{roles.map((key) => {
											const match = relationTypes.find((rt) => rt.key === key);
											return (
												<Badge key={key} variant="outline" className="gap-1.5 text-xs font-normal">
													{match?.color && (
														<div
															className="h-2 w-2 rounded-full"
															style={{ backgroundColor: match.color }}
														/>
													)}
													{match?.label ?? key}
												</Badge>
											);
										})}
									</div>
								);
							},
							meta: {
								label: "Applicable Roles",
								width: 240,
								minWidth: 200,
							},
							enableSorting: false,
							enableHiding: true,
						} satisfies ColumnDef<Configuration>,
					]
				: []),
			// Event type → "Booking Types" column (resolves metadata.bookingTypes keys to labels)
			...(configType === "event_type"
				? [
						{
							id: "applicableBookingTypes",
							header: ({ column }: { column: unknown }) => (
								<DataTableColumnHeader column={column as never} title="Booking Types" />
							),
							cell: ({ row }: { row: { original: Configuration } }) => {
								const bTypes = (row.original.metadata as Record<string, unknown> | null)?.bookingTypes;
								if (!Array.isArray(bTypes) || bTypes.length === 0) {
									return <span className="text-muted-foreground">All types</span>;
								}
								return (
									<div className="flex flex-wrap gap-1">
										{bTypes.map((key) => {
											const match = bookingTypes.find((bt) => bt.key === key);
											return (
												<Badge key={key} variant="outline" className="gap-1.5 text-xs font-normal">
													{match?.color && (
														<div
															className="h-2 w-2 rounded-full"
															style={{ backgroundColor: match.color }}
														/>
													)}
													{match?.label ?? key}
												</Badge>
											);
										})}
									</div>
								);
							},
							meta: {
								label: "Booking Types",
								width: 240,
								minWidth: 200,
							},
							enableSorting: false,
							enableHiding: true,
						} satisfies ColumnDef<Configuration>,
					]
				: []),
			// Relation type → "Booking Types" column (resolves metadata.bookingTypes keys to labels)
			...(configType === "relation_type"
				? [
						{
							id: "applicableBookingTypes",
							header: ({ column }: { column: unknown }) => (
								<DataTableColumnHeader column={column as never} title="Booking Types" />
							),
							cell: ({ row }: { row: { original: Configuration } }) => {
								const bTypes = (row.original.metadata as Record<string, unknown> | null)?.bookingTypes;
								if (!Array.isArray(bTypes) || bTypes.length === 0) {
									return <span className="text-muted-foreground">All types</span>;
								}
								return (
									<div className="flex flex-wrap gap-1">
										{bTypes.map((key) => {
											const match = bookingTypes.find((bt) => bt.key === key);
											return (
												<Badge key={key} variant="outline" className="gap-1.5 text-xs font-normal">
													{match?.color && (
														<div
															className="h-2 w-2 rounded-full"
															style={{ backgroundColor: match.color }}
														/>
													)}
													{match?.label ?? key}
												</Badge>
											);
										})}
									</div>
								);
							},
							meta: {
								label: "Booking Types",
								width: 240,
								minWidth: 200,
							},
							enableSorting: false,
							enableHiding: true,
						} satisfies ColumnDef<Configuration>,
					]
				: []),
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
				id: "isActive",
				accessorKey: "isActive",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Status"
						className="justify-center"
					/>
				),
				cell: ({ row }) => (
					<div className="flex justify-center">
						{row.original.isActive ? (
							<Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
								Active
							</Badge>
						) : (
							<Badge variant="outline" className="text-muted-foreground">
								Inactive
							</Badge>
						)}
					</div>
				),
				meta: {
					label: "Status",
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
		[rowActions, configType, bookingTypes, relationTypes, openView],
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
					stickyLeftColumns={[{ id: "label", width: 220 }]}
					stickyRightColumns={[{ id: "actions", width: 56 }]}
					minWidth={1000}
					scrollStartColumn={1}
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
