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
	DataTableViewOptions,
	type RowAction,
	SortProvider,
} from "@saas/shared/components/data-table";
// Import types for column meta augmentation
import "@saas/shared/components/data-table/types";
import { useShootParams } from "@saas/studio/hooks/params/use-shoot-params";
import { useShootsTable } from "@saas/studio/hooks/tables";
import {
	configurationsApi,
	shootsApi,
	shootsMutations,
} from "@saas/studio/lib/api";
import { getShootExtraServiceLabel } from "@saas/studio/lib/shoot-planning";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CalendarIcon,
	CameraIcon,
	CheckCircleIcon,
	CircleIcon,
	EyeIcon,
	Loader2Icon,
	PauseCircleIcon,
	PencilIcon,
	PlayCircleIcon,
	TrashIcon,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
	const router = useRouter();
	const queryClient = useQueryClient();

	// Use the shoots table hook for URL-synced state
	const {
		filters,
		pagination,
		sorting,
		sortingState,
		columnVisibility,
		onColumnVisibilityChange,
		onSortingChange,
		onPaginationChange,
		onLimitChange,
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
				queryKey: orpc.shoots.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
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
				label: "View details",
				icon: <EyeIcon className="h-4 w-4" />,
				onClick: (row) =>
					router.push(`/app/${organizationSlug}/shoots/${row.id}`),
			},
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
		[organizationSlug, router],
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
						<span className="text-muted-foreground">
							{date.toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
								year: "numeric",
							})}
						</span>
					);
				},
				meta: {
					label: "Date",
					variant: "dateRange" as const,
					icon: CalendarIcon,
					width: 140,
					minWidth: 140,
					headerClassName:
						"!border-r-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle",
					cellClassName:
						"!border-r-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle",
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "eventBooking",
				accessorKey: "shootType",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Shoot" />
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<Link
							href={`/app/${organizationSlug}/shoots/${row.original.id}`}
							className="font-medium text-foreground hover:underline"
						>
							{formatShootType(row.original.shootType)}
						</Link>
						<span className="text-muted-foreground">·</span>
						<Link
							href={`/app/${organizationSlug}/bookings/${row.original.bookingId}`}
							className="text-muted-foreground hover:underline hover:text-foreground transition-colors"
						>
							{row.original.bookingName}
						</Link>
					</div>
				),
				meta: {
					label: "Shoot",
					width: 300,
					minWidth: 250,
					// Last left-sticky column - add right border
					headerClassName:
						"!border-r-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[0.5px] after:bg-table-border-subtle",
					cellClassName:
						"!border-r-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[0.5px] after:bg-table-border-subtle",
				},
				enableSorting: true,
				enableHiding: false,
			},
			{
				id: "time",
				accessorKey: "startTime",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Time" />
				),
				cell: ({ row }) => {
					if (!row.original.startTime) {
						return <span className="text-muted-foreground">—</span>;
					}
					return (
						<span className="text-muted-foreground tabular-nums">
							{row.original.startTime}
							{row.original.endTime &&
								` - ${row.original.endTime}`}
						</span>
					);
				},
				meta: {
					label: "Time",
					width: 120,
					minWidth: 100,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "venue",
				accessorKey: "venue",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Location" />
				),
				cell: ({ row }) =>
					row.original.venue ? (
						<span
							className="truncate max-w-[200px] block"
							title={row.original.venue}
						>
							{row.original.venue}
						</span>
					) : (
						<span className="text-muted-foreground">—</span>
					),
				meta: {
					label: "Location",
					width: 200,
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
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Crew Plan" />
				),
				cell: ({ row }) => {
					const assigned = row.original.assignmentsCount;
					const required = row.original.requiredCrewCount;

					if (!required) {
						return <span className="tabular-nums">{assigned}</span>;
					}

					return (
						<span className="tabular-nums">
							{assigned} / {required}
						</span>
					);
				},
				meta: {
					label: "Crew Plan",
					width: 90,
					minWidth: 90,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "additionalServices",
				accessorKey: "additionalServices",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Extra Services"
					/>
				),
				cell: ({ row }) => {
					if (row.original.additionalServices.length === 0) {
						return <span className="text-muted-foreground">—</span>;
					}

					return (
						<div className="flex flex-wrap gap-1">
							{row.original.additionalServices.map((service) => (
								<Badge
									key={service}
									variant="outline"
									className="text-[10px]"
								>
									{getShootExtraServiceLabel(service)}
								</Badge>
							))}
						</div>
					);
				},
				meta: {
					label: "Extra Services",
					width: 200,
					minWidth: 160,
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
					width: 48,
					minWidth: 48,
					// First right-sticky column - add left border + fade
					headerClassName:
						"!px-0 md:sticky md:right-0 bg-gray-100 z-10",
					cellClassName:
						"!px-0 md:sticky md:right-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10",
				},
			},
		],
		[organizationSlug, rowActions, statusLabels, statusOptions],
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
					data={shoots}
					isLoading={isLoading}
					isFetching={isFetching}
					pagination={serverPagination}
					onPaginationChange={onPaginationChange}
					onLimitChange={onLimitChange}
					sorting={sortingState}
					onSortingChange={onSortingChange}
					columnVisibility={columnVisibility}
					onColumnVisibilityChange={onColumnVisibilityChange}
					enableRowSelection
					getRowId={(row) => row.id}
					// Sticky columns configuration
					stickyLeftColumns={[
						{ id: "select", width: 48 },
						{ id: "shootDate", width: 140 },
						{ id: "eventBooking", width: 300 },
					]}
					stickyRightColumns={[{ id: "actions", width: 48 }]}
					minWidth={1560}
					// Place scroll controls in the last sticky left column
					scrollControlsColumnId="eventBooking"
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
