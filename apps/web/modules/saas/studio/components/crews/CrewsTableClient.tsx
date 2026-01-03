"use client";

import type { Crew } from "@repo/api/modules/studio/schemas/crew";
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
	createSelectColumn,
	DataTable,
	DataTableColumnHeader,
	DataTableRowActions,
	DataTableToolbar,
	DataTableViewOptions,
	type RowAction,
	SortProvider,
} from "@saas/shared/components/data-table";
// Import types for column meta augmentation
import "@saas/shared/components/data-table/types";
import { useCrewParams } from "@saas/studio/hooks/params/use-crew-params";
import { useCrewsTable } from "@saas/studio/hooks/tables";
import {
	crewsApi,
	crewsMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	BriefcaseIcon,
	Loader2Icon,
	PencilIcon,
	PhoneIcon,
	TrashIcon,
	UserIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OpenCrewCreateSheet } from "./OpenCrewSheet";

// Note: organizationSlug kept for future crew detail page navigation
interface CrewsTableClientProps {
	organizationSlug?: string;
}

const statusColors: Record<string, string> = {
	active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	inactive:
		"bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
	unavailable:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const statusOptions = [
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
	{ value: "unavailable", label: "Unavailable" },
];

const roleOptions = [
	{ value: "photographer", label: "Photographer" },
	{ value: "videographer", label: "Videographer" },
	{ value: "editor", label: "Editor" },
	{ value: "assistant", label: "Assistant" },
	{ value: "makeup_artist", label: "Makeup Artist" },
	{ value: "coordinator", label: "Coordinator" },
	{ value: "other", label: "Other" },
];

const formatMoney = (value: string | null) => {
	if (!value) {
		return "-";
	}
	const num = Number.parseFloat(value);
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
	}).format(num);
};

export function CrewsTableClient({
	organizationSlug: _organizationSlug,
}: CrewsTableClientProps) {
	const queryClient = useQueryClient();

	// Use the crews table hook for URL-synced state
	const {
		filters,
		pagination,
		sorting,
		sortingState,
		setFilter,
		resetFilters,
		isFiltered,
		onSortingChange,
		onPaginationChange,
	} = useCrewsTable();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [crewToDelete, setCrewToDelete] = useState<Crew | null>(null);

	// URL-based sheet params
	const { openEdit } = useCrewParams();

	// Build query input from hook state
	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		status: filters.status ?? undefined,
		role: filters.role ?? undefined,
		sortBy: sorting.sortBy ?? "name",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	// Fetch crews with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		crewsApi.listOptions(queryInput),
	);

	const crews = data?.data ?? [];
	const serverPagination = data?.pagination ?? {
		page: 1,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	// Delete mutation
	const deleteMutation = useMutation({
		...crewsMutations.delete(),
		onSuccess: () => {
			toast.success("Crew member deleted successfully");
			setDeleteDialogOpen(false);
			setCrewToDelete(null);
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.crews.all,
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete crew member");
		},
	});

	const handleOpenEdit = (crew: Crew) => {
		openEdit(crew.id);
	};

	// Define row actions
	const rowActions: RowAction<Crew>[] = useMemo(
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
					setCrewToDelete(row);
					setDeleteDialogOpen(true);
				},
			},
		],
		[],
	);

	// Define columns with sortable headers and meta for filters
	const columns: ColumnDef<Crew>[] = useMemo(
		() => [
			createSelectColumn<Crew>(),
			{
				id: "name",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Name" />
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
							<UserIcon className="h-4 w-4 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium">{row.original.name}</p>
							{row.original.email && (
								<p className="text-sm text-muted-foreground">
									{row.original.email}
								</p>
							)}
						</div>
					</div>
				),
				meta: {
					label: "Name",
					width: 240,
					minWidth: 240,
					// Last left-sticky column - add right border
					headerClassName:
						"!border-r-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border",
					cellClassName:
						"!border-r-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border",
				},
				enableSorting: true,
				enableHiding: false,
			},
			{
				id: "role",
				accessorKey: "role",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Role" />
				),
				cell: ({ row }) => (
					<span className="capitalize">
						{row.original.role.replace(/_/g, " ")}
					</span>
				),
				meta: {
					label: "Role",
					variant: "multiSelect" as const,
					icon: BriefcaseIcon,
					options: roleOptions,
					width: 140,
					minWidth: 140,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "phoneNumber",
				accessorKey: "phoneNumber",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Phone" />
				),
				cell: ({ row }) => row.original.phoneNumber || "-",
				meta: {
					label: "Phone",
					icon: PhoneIcon,
					width: 140,
					minWidth: 140,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "status",
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => (
					<Badge
						variant="secondary"
						className={
							statusColors[row.original.status] ??
							statusColors.active
						}
					>
						{row.original.status}
					</Badge>
				),
				meta: {
					label: "Status",
					variant: "multiSelect" as const,
					icon: UserIcon,
					options: statusOptions,
					width: 120,
					minWidth: 120,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "dailyRate",
				accessorKey: "dailyRate",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Daily Rate"
						className="justify-end"
					/>
				),
				cell: ({ row }) => (
					<div className="text-right font-semibold tabular-nums">
						{formatMoney(row.original.dailyRate)}
					</div>
				),
				meta: {
					label: "Daily Rate",
					width: 120,
					minWidth: 120,
				},
				enableSorting: true,
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
					// First right-sticky column - add left border + fade
					headerClassName:
						"!px-0 md:sticky md:right-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-background",
					cellClassName:
						"!px-0 md:sticky md:right-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-background",
				},
			},
		],
		[rowActions],
	);

	return (
		<>
			<div className="space-y-4">
				{/* Toolbar with filters */}
				<div className="flex items-center justify-between gap-4">
					<DataTableToolbar
						filters={[
							{
								id: "status",
								label: "Status",
								variant: "multiSelect",
								options: statusOptions,
								icon: UserIcon,
							},
							{
								id: "role",
								label: "Role",
								variant: "multiSelect",
								options: roleOptions,
								icon: BriefcaseIcon,
							},
						]}
						filterValues={{
							status: filters.status ?? [],
							role: filters.role ?? [],
						}}
						onFilterChange={(id, value) => {
							if (id === "status") {
								setFilter("status", value as string[]);
							} else if (id === "role") {
								setFilter("role", value as string[]);
							}
						}}
						onResetFilters={resetFilters}
						isFiltered={isFiltered}
						showSearch
						searchValue={filters.search ?? ""}
						searchPlaceholder="Search crew members..."
						onSearchChange={(value) =>
							setFilter("search", value || null)
						}
						className="flex-1"
					/>
					<OpenCrewCreateSheet />
				</div>

				{/* Table with sort context */}
				<SortProvider
					sortColumn={sorting.sortBy}
					sortDirection={sorting.sortDirection}
				>
					<DataTable
						columns={columns}
						data={crews}
						isLoading={isLoading}
						isFetching={isFetching}
						pagination={serverPagination}
						onPaginationChange={onPaginationChange}
						sorting={sortingState}
						onSortingChange={onSortingChange}
						enableRowSelection
						getRowId={(row) => row.id}
						// Sticky columns configuration
						stickyLeftColumns={[
							{ id: "select", width: 56 },
							{ id: "name", width: 240 },
						]}
						stickyRightColumns={[{ id: "actions", width: 56 }]}
						minWidth={900}
						// Place scroll controls in the last sticky left column
						scrollControlsColumnId="name"
						scrollStartColumn={2}
						emptyState={
							<div className="flex flex-col items-center gap-2">
								<UserIcon className="h-12 w-12 text-muted-foreground/50" />
								<p className="text-muted-foreground">
									No crew members found
								</p>
								<OpenCrewCreateSheet
									variant="outline"
									size="sm"
									label="Add your first crew member"
								/>
							</div>
						}
					/>
				</SortProvider>
			</div>

			{/* Delete confirmation dialog */}
			<AlertDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete crew member?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{crewToDelete?.name}".
							This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (crewToDelete) {
									deleteMutation.mutate({
										id: crewToDelete.id,
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
