"use client";

import type { ShootListItem } from "@repo/api/modules/studio/schemas/shoot";
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
import { useShootParams } from "@saas/studio/hooks/params/use-shoot-params";
import { SHOOT_TYPE_OPTIONS, useShootsTable } from "@saas/studio/hooks/tables";
import {
	configurationsApi,
	shootsApi,
	shootsMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CalendarIcon,
	CameraIcon,
	CheckCircleIcon,
	CircleIcon,
	ClockIcon,
	Loader2Icon,
	MapPinIcon,
	PauseCircleIcon,
	PencilIcon,
	PlayCircleIcon,
	TagIcon,
	TrashIcon,
	UsersIcon,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OpenShootCreateSheet } from "./OpenShootSheet";

interface ShootsTableClientProps {
	organizationSlug: string;
}

// Default status labels (fallback if configuration not loaded)
const DEFAULT_STATUS_LABELS: Record<string, string> = {
	scheduled: "Scheduled",
	confirmed: "Confirmed",
	in_progress: "In Progress",
	completed: "Completed",
	cancelled: "Cancelled",
	postponed: "Postponed",
};

const STATUS_VARIANTS: Record<
	string,
	"default" | "secondary" | "outline" | "destructive"
> = {
	scheduled: "outline",
	confirmed: "secondary",
	in_progress: "default",
	completed: "default",
	cancelled: "destructive",
	postponed: "outline",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
	scheduled: CircleIcon,
	confirmed: CheckCircleIcon,
	in_progress: PlayCircleIcon,
	completed: CheckCircleIcon,
	cancelled: XCircleIcon,
	postponed: PauseCircleIcon,
};

// Format shoot type for display
function formatShootType(type: string): string {
	return type
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export function ShootsTableClient({
	organizationSlug,
}: ShootsTableClientProps) {
	const queryClient = useQueryClient();

	// Use the shoots table hook for URL-synced state
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
	} = useShootsTable();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [shootToDelete, setShootToDelete] = useState<ShootListItem | null>(
		null,
	);

	// URL-based sheet params
	const { openEdit } = useShootParams();

	// Fetch shoot status configurations for filter options
	const { data: shootStatusData } = useQuery(
		configurationsApi.shootStatusOptions(),
	);

	// Build status options from configurations
	const statusOptions = useMemo(() => {
		if (shootStatusData?.data && shootStatusData.data.length > 0) {
			return shootStatusData.data.map((config) => ({
				value: config.key,
				label: config.label,
			}));
		}
		// Fallback to default statuses
		return Object.entries(DEFAULT_STATUS_LABELS).map(([key, label]) => ({
			value: key,
			label,
		}));
	}, [shootStatusData]);

	// Create status labels map
	const statusLabels = useMemo(() => {
		const labels = { ...DEFAULT_STATUS_LABELS };
		if (shootStatusData?.data) {
			for (const config of shootStatusData.data) {
				labels[config.key] = config.label;
			}
		}
		return labels;
	}, [shootStatusData]);

	// Build query input from hook state
	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		shootType: filters.shootType ?? undefined,
		status: filters.status ?? undefined,
		dateFrom: filters.shootDate?.[0] ?? undefined,
		dateTo: filters.shootDate?.[1] ?? undefined,
		sortBy: (sorting.sortBy ?? "shootDate") as
			| "name"
			| "shootDate"
			| "shootType"
			| "status"
			| "createdAt",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	// Fetch shoots with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		shootsApi.listOptions(queryInput),
	);

	const shoots = data?.data ?? [];
	const serverPagination = data?.pagination ?? {
		page: 1,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	// Delete mutation
	const deleteMutation = useMutation({
		...shootsMutations.delete(),
		onSuccess: () => {
			toast.success("Shoot deleted successfully");
			setDeleteDialogOpen(false);
			setShootToDelete(null);
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.shoots.all,
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete shoot");
		},
	});

	const handleOpenEdit = (shoot: ShootListItem) => {
		openEdit(shoot.id);
	};

	// Define row actions
	const rowActions: RowAction<ShootListItem>[] = useMemo(
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
					setShootToDelete(row);
					setDeleteDialogOpen(true);
				},
			},
		],
		[],
	);

	// Define columns with sortable headers and meta for filters
	const columns: ColumnDef<ShootListItem>[] = useMemo(
		() => [
			createSelectColumn<ShootListItem>(),
			{
				id: "shootDate",
				accessorKey: "shootDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Date" />
				),
				cell: ({ row }) => {
					const date = new Date(row.original.shootDate);
					return (
						<div className="flex flex-col gap-0.5 leading-none">
							<span className="text-sm font-medium text-foreground">
								{date.toLocaleDateString("en-IN", {
									day: "numeric",
									month: "short",
									year: "numeric",
								})}
							</span>
							{(row.original.startTime ||
								row.original.endTime) && (
								<span className="flex items-center gap-1 text-xs text-muted-foreground">
									<ClockIcon className="h-3 w-3" />
									{row.original.startTime || "--:--"}
									{row.original.endTime &&
										` - ${row.original.endTime}`}
								</span>
							)}
						</div>
					);
				},
				meta: {
					label: "Date",
					variant: "dateRange" as const,
					icon: CalendarIcon,
					width: 140,
					minWidth: 140,
					headerClassName:
						"!border-r-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border",
					cellClassName:
						"!border-r-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border",
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "name",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Name" />
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
							<CameraIcon className="h-4 w-4 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium">{row.original.name}</p>
							<p className="text-xs text-muted-foreground">
								{row.original.bookingReferenceNumber}
							</p>
						</div>
					</div>
				),
				meta: {
					label: "Name",
					width: 220,
					minWidth: 220,
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
				id: "booking",
				accessorKey: "bookingName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Booking" />
				),
				cell: ({ row }) => (
					<Link
						href={`/app/${organizationSlug}/bookings/${row.original.bookingId}`}
						className="font-medium text-foreground hover:underline"
					>
						{row.original.bookingName}
					</Link>
				),
				meta: {
					label: "Booking",
					width: 180,
					minWidth: 180,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "shootType",
				accessorKey: "shootType",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Type" />
				),
				cell: ({ row }) => (
					<Badge variant="secondary">
						{formatShootType(row.original.shootType)}
					</Badge>
				),
				meta: {
					label: "Type",
					variant: "multiSelect" as const,
					icon: TagIcon,
					options: SHOOT_TYPE_OPTIONS,
					width: 130,
					minWidth: 130,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "venue",
				accessorKey: "venue",
				header: () => (
					<span className="text-foreground flex h-8 items-center text-xs font-semibold uppercase tracking-wide">
						Venue
					</span>
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-2 max-w-[180px]">
						{row.original.venue ? (
							<>
								<MapPinIcon className="h-4 w-4 text-muted-foreground shrink-0" />
								<span className="truncate">
									{row.original.venue}
								</span>
							</>
						) : (
							<span className="text-muted-foreground">-</span>
						)}
					</div>
				),
				meta: {
					label: "Venue",
					width: 180,
					minWidth: 180,
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
				cell: ({ row }) => {
					const status = row.original.status;
					const StatusIcon = STATUS_ICONS[status] ?? CircleIcon;
					return (
						<Badge variant={STATUS_VARIANTS[status] ?? "outline"}>
							<StatusIcon className="mr-1 h-3 w-3" />
							{statusLabels[status] ?? status}
						</Badge>
					);
				},
				meta: {
					label: "Status",
					variant: "multiSelect" as const,
					icon: CircleIcon,
					options: statusOptions,
					width: 130,
					minWidth: 130,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "assignmentsCount",
				accessorKey: "assignmentsCount",
				header: () => (
					<span className="text-foreground flex h-8 items-center text-xs font-semibold uppercase tracking-wide">
						Crew
					</span>
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<UsersIcon className="h-4 w-4 text-muted-foreground" />
						<span>{row.original.assignmentsCount}</span>
					</div>
				),
				meta: {
					label: "Crew",
					width: 80,
					minWidth: 80,
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
					// First right-sticky column - add left border + fade
					headerClassName:
						"!px-0 md:sticky md:right-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-background",
					cellClassName:
						"!px-0 md:sticky md:right-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-background",
				},
			},
		],
		[organizationSlug, rowActions, statusLabels, statusOptions],
	);

	return (
		<>
			<div className="space-y-4">
				{/* Toolbar with filters */}
				<div className="flex items-center justify-between gap-4">
					<DataTableToolbar
						filters={[
							{
								id: "shootType",
								label: "Type",
								variant: "multiSelect",
								options: SHOOT_TYPE_OPTIONS,
								icon: TagIcon,
							},
							{
								id: "status",
								label: "Status",
								variant: "multiSelect",
								options: statusOptions,
								icon: CircleIcon,
							},
						]}
						filterValues={{
							shootType: filters.shootType ?? [],
							status: filters.status ?? [],
						}}
						onFilterChange={(id, value) => {
							if (id === "shootType") {
								setFilter("shootType", value as string[]);
							} else if (id === "status") {
								setFilter("status", value as string[]);
							}
						}}
						onResetFilters={resetFilters}
						isFiltered={isFiltered}
						showSearch
						searchValue={filters.search ?? ""}
						searchPlaceholder="Search shoots..."
						onSearchChange={(value) =>
							setFilter("search", value || null)
						}
						className="flex-1"
					/>
					<OpenShootCreateSheet />
				</div>

				{/* Table with sort context */}
				<SortProvider
					sortColumn={sorting.sortBy}
					sortDirection={sorting.sortDirection}
				>
					<DataTable
						columns={columns}
						data={shoots}
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
							{ id: "shootDate", width: 140 },
							{ id: "name", width: 220 },
						]}
						stickyRightColumns={[{ id: "actions", width: 56 }]}
						minWidth={1200}
						// Place scroll controls in the last sticky left column
						scrollControlsColumnId="name"
						scrollStartColumn={3}
						emptyState={
							<div className="flex flex-col items-center gap-2">
								<CameraIcon className="h-12 w-12 text-muted-foreground/50" />
								<p className="text-muted-foreground">
									No shoots found
								</p>
								<OpenShootCreateSheet
									variant="outline"
									size="sm"
									label="Add your first shoot"
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
						<AlertDialogTitle>Delete shoot?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{shootToDelete?.name}
							". This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (shootToDelete) {
									deleteMutation.mutate({
										id: shootToDelete.id,
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
