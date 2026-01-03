"use client";

import type { DeliverableListItem } from "@repo/api/modules/studio/schemas/deliverable";
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
import { useDeliverableParams } from "@saas/studio/hooks/params/use-deliverable-params";
import {
	DELIVERABLE_PRIORITIES,
	DELIVERABLE_STATUSES,
	DELIVERABLE_TYPES,
	useDeliverablesTable,
} from "@saas/studio/hooks/tables";
import {
	deliverablesApi,
	deliverablesMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	AlertCircleIcon,
	CalendarIcon,
	CheckCircleIcon,
	CircleIcon,
	ClockIcon,
	Loader2Icon,
	PackageIcon,
	PencilIcon,
	TagIcon,
	TrashIcon,
	TruckIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OpenDeliverableCreateSheet } from "./OpenDeliverableSheet";

interface DeliverablesTableClientProps {
	organizationSlug: string;
}

const DELIVERABLE_TYPE_LABELS: Record<string, string> = {
	wedding_album: "Wedding Album",
	pre_wedding_album: "Pre-Wedding Album",
	photo_album: "Photo Album",
	highlight_video: "Highlight Video",
	full_video: "Full Video",
	teaser: "Teaser",
	reel: "Reel",
	edited_photos: "Edited Photos",
	raw_photos: "Raw Photos",
	raw_videos: "Raw Videos",
	drone_footage: "Drone Footage",
	frame: "Frame",
	canvas: "Canvas",
	other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
	pending: "Pending",
	in_progress: "In Progress",
	completed: "Completed",
	delivered: "Delivered",
};

const STATUS_VARIANTS: Record<
	string,
	"default" | "secondary" | "outline" | "destructive"
> = {
	pending: "secondary",
	in_progress: "outline",
	completed: "default",
	delivered: "default",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
	pending: CircleIcon,
	in_progress: ClockIcon,
	completed: CheckCircleIcon,
	delivered: TruckIcon,
};

const PRIORITY_LABELS: Record<string, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
};

const PRIORITY_VARIANTS: Record<
	string,
	"default" | "secondary" | "outline" | "destructive"
> = {
	low: "outline",
	medium: "secondary",
	high: "destructive",
};

const formatDate = (dateStr: string | null) => {
	if (!dateStr) {
		return "-";
	}
	return new Date(dateStr).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
};

// Filter options
const deliverableTypeOptions = DELIVERABLE_TYPES.map((type) => ({
	value: type,
	label: DELIVERABLE_TYPE_LABELS[type] ?? type,
}));

const statusOptions = DELIVERABLE_STATUSES.map((status) => ({
	value: status,
	label: STATUS_LABELS[status] ?? status,
}));

const priorityOptions = DELIVERABLE_PRIORITIES.map((priority) => ({
	value: priority,
	label: PRIORITY_LABELS[priority] ?? priority,
}));

export function DeliverablesTableClient({
	organizationSlug,
}: DeliverablesTableClientProps) {
	const queryClient = useQueryClient();

	// Use the deliverables table hook for URL-synced state
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
	} = useDeliverablesTable();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deliverableToDelete, setDeliverableToDelete] =
		useState<DeliverableListItem | null>(null);

	// URL-based sheet params
	const { openEdit } = useDeliverableParams();

	// Build query input from hook state
	// Note: API expects single values for deliverableType, status, priority
	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		deliverableType: filters.deliverableType?.[0] ?? undefined,
		status: filters.status?.[0] ?? undefined,
		priority: filters.priority?.[0] ?? undefined,
		sortBy: sorting.sortBy ?? "dueDate",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	// Fetch deliverables with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		deliverablesApi.listOptions(queryInput),
	);

	const deliverables = data?.data ?? [];
	const serverPagination = data?.pagination ?? {
		page: 1,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	// Delete mutation
	const deleteMutation = useMutation({
		...deliverablesMutations.delete(),
		onSuccess: () => {
			toast.success("Deliverable deleted successfully");
			setDeleteDialogOpen(false);
			setDeliverableToDelete(null);
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.deliverables.all,
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete deliverable");
		},
	});

	const handleOpenEdit = (deliverable: DeliverableListItem) => {
		openEdit(deliverable.id);
	};

	// Define row actions
	const rowActions: RowAction<DeliverableListItem>[] = useMemo(
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
					setDeliverableToDelete(row);
					setDeleteDialogOpen(true);
				},
			},
		],
		[],
	);

	// Define columns with sortable headers and meta for filters
	const columns: ColumnDef<DeliverableListItem>[] = useMemo(
		() => [
			createSelectColumn<DeliverableListItem>(),
			{
				id: "name",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Name" />
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
							<PackageIcon className="h-4 w-4 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium">{row.original.name}</p>
							<p className="text-xs text-muted-foreground">
								{DELIVERABLE_TYPE_LABELS[
									row.original.deliverableType
								] ?? row.original.deliverableType}
							</p>
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
				id: "booking",
				accessorKey: "bookingName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Booking" />
				),
				cell: ({ row }) => (
					<div>
						<Link
							href={`/app/${organizationSlug}/bookings/${row.original.bookingId}`}
							className="font-medium text-foreground hover:underline"
						>
							{row.original.bookingName}
						</Link>
						<p className="text-xs text-muted-foreground">
							{row.original.bookingReferenceNumber}
						</p>
					</div>
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
				id: "deliverableType",
				accessorKey: "deliverableType",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Type" />
				),
				cell: ({ row }) => (
					<Badge variant="outline">
						{DELIVERABLE_TYPE_LABELS[
							row.original.deliverableType
						] ?? row.original.deliverableType}
					</Badge>
				),
				meta: {
					label: "Type",
					variant: "multiSelect" as const,
					icon: TagIcon,
					options: deliverableTypeOptions,
					width: 140,
					minWidth: 140,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "dueDate",
				accessorKey: "dueDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Due Date" />
				),
				cell: ({ row }) => {
					const dueDate = row.original.dueDate;
					const isOverdue =
						dueDate &&
						new Date(dueDate) < new Date() &&
						row.original.status !== "completed" &&
						row.original.status !== "delivered";

					return (
						<div className="flex items-center gap-2">
							{isOverdue ? (
								<AlertCircleIcon className="h-4 w-4 text-destructive" />
							) : (
								<CalendarIcon className="h-4 w-4 text-muted-foreground" />
							)}
							<span
								className={isOverdue ? "text-destructive" : ""}
							>
								{formatDate(dueDate)}
							</span>
						</div>
					);
				},
				meta: {
					label: "Due Date",
					icon: CalendarIcon,
					width: 130,
					minWidth: 130,
				},
				enableSorting: true,
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
							{STATUS_LABELS[status] ?? status}
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
				id: "priority",
				accessorKey: "priority",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Priority" />
				),
				cell: ({ row }) => {
					const priority = row.original.priority;
					return (
						<Badge
							variant={PRIORITY_VARIANTS[priority] ?? "outline"}
						>
							{PRIORITY_LABELS[priority] ?? priority}
						</Badge>
					);
				},
				meta: {
					label: "Priority",
					variant: "multiSelect" as const,
					icon: AlertCircleIcon,
					options: priorityOptions,
					width: 100,
					minWidth: 100,
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
		[organizationSlug, rowActions],
	);

	return (
		<>
			<div className="space-y-4">
				{/* Toolbar with filters */}
				<div className="flex items-center justify-between gap-4">
					<DataTableToolbar
						filters={[
							{
								id: "deliverableType",
								label: "Type",
								variant: "multiSelect",
								options: deliverableTypeOptions,
								icon: TagIcon,
							},
							{
								id: "status",
								label: "Status",
								variant: "multiSelect",
								options: statusOptions,
								icon: CircleIcon,
							},
							{
								id: "priority",
								label: "Priority",
								variant: "multiSelect",
								options: priorityOptions,
								icon: AlertCircleIcon,
							},
						]}
						filterValues={{
							deliverableType: filters.deliverableType ?? [],
							status: filters.status ?? [],
							priority: filters.priority ?? [],
						}}
						onFilterChange={(id, value) => {
							if (id === "deliverableType") {
								setFilter("deliverableType", value as string[]);
							} else if (id === "status") {
								setFilter("status", value as string[]);
							} else if (id === "priority") {
								setFilter("priority", value as string[]);
							}
						}}
						onResetFilters={resetFilters}
						isFiltered={isFiltered}
						showSearch
						searchValue={filters.search ?? ""}
						searchPlaceholder="Search deliverables..."
						onSearchChange={(value) =>
							setFilter("search", value || null)
						}
						className="flex-1"
					/>
					<OpenDeliverableCreateSheet />
				</div>

				{/* Table with sort context */}
				<SortProvider
					sortColumn={sorting.sortBy}
					sortDirection={sorting.sortDirection}
				>
					<DataTable
						columns={columns}
						data={deliverables}
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
						minWidth={1200}
						// Place scroll controls in the last sticky left column
						scrollControlsColumnId="name"
						scrollStartColumn={2}
						emptyState={
							<div className="flex flex-col items-center gap-2">
								<PackageIcon className="h-12 w-12 text-muted-foreground/50" />
								<p className="text-muted-foreground">
									No deliverables found
								</p>
								<OpenDeliverableCreateSheet
									variant="outline"
									size="sm"
									label="Add your first deliverable"
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
						<AlertDialogTitle>Delete deliverable?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "
							{deliverableToDelete?.name}". This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (deliverableToDelete) {
									deleteMutation.mutate({
										id: deliverableToDelete.id,
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
