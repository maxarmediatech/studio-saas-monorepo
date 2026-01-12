"use client";

import type { PaymentScheduleStatus } from "@repo/api/modules/studio/schemas/common";
import type { PaymentScheduleListItem } from "@repo/api/modules/studio/schemas/payment";
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
	DataTableToolbarWithViews,
	DataTableViewOptions,
	type RowAction,
	SortProvider,
} from "@saas/shared/components/data-table";
import type { SavedView } from "@saas/shared/components/views";
// Import types for column meta augmentation
import "@saas/shared/components/data-table/types";
import { cn } from "@repo/ui/lib/utils";
import { formatMoney } from "@saas/shared/lib";
import { useScheduleParams } from "@saas/studio/hooks/params/use-schedule-params";
import {
	SCHEDULE_STATUSES,
	useSchedulesTableWithViews,
} from "@saas/studio/hooks/tables";
import {
	studioPaymentsApi,
	studioPaymentsMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	AlertTriangleIcon,
	CalendarClockIcon,
	CalendarIcon,
	CheckCircle2Icon,
	CircleDashedIcon,
	Loader2Icon,
	PencilIcon,
	TrashIcon,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OpenScheduleCreateSheet } from "./OpenScheduleSheet";

interface SchedulesTableClientProps {
	organizationSlug?: string;
}

const STATUS_LABELS: Record<string, string> = {
	pending: "Pending",
	partial: "Partial",
	completed: "Completed",
	overdue: "Overdue",
	cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<
	string,
	"default" | "secondary" | "destructive" | "outline"
> = {
	pending: "default",
	partial: "secondary",
	completed: "default",
	overdue: "destructive",
	cancelled: "outline",
};

const STATUS_ICONS: Record<string, typeof CircleDashedIcon> = {
	pending: CircleDashedIcon,
	partial: CalendarClockIcon,
	completed: CheckCircle2Icon,
	overdue: AlertTriangleIcon,
	cancelled: XCircleIcon,
};

// Derive statusOptions from the source of truth
const statusOptions = SCHEDULE_STATUSES.map((status) => ({
	value: status,
	label: STATUS_LABELS[status],
}));

const formatDate = (dateStr: string) => {
	return new Date(dateStr).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
};

/**
 * Check if a date is overdue (before today)
 */
const isOverdue = (dateStr: string, status: string) => {
	if (status === "completed" || status === "cancelled") return false;
	const dueDate = new Date(dateStr);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	dueDate.setHours(0, 0, 0, 0);
	return dueDate < today;
};

export function SchedulesTableClient({
	organizationSlug,
}: SchedulesTableClientProps) {
	const queryClient = useQueryClient();

	const {
		filters,
		pagination,
		sorting,
		sortingState,
		setFilter,
		resetFilters,
		isFiltered,
		activeViewId,
		applyView,
		columnVisibility,
		onSortingChange,
		onPaginationChange,
		onLimitChange,
	} = useSchedulesTableWithViews();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [scheduleToDelete, setScheduleToDelete] =
		useState<PaymentScheduleListItem | null>(null);

	// URL-based sheet params (openEdit used inline in rowActions)
	const { openEdit } = useScheduleParams();

	// Build query input from hook state
	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		status: filters.status as PaymentScheduleStatus[] | undefined,
		sortBy: sorting.sortBy ?? "dueDate",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	// Fetch schedules with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		studioPaymentsApi.listSchedulesOptions(queryInput),
	);

	const schedules = data?.data ?? [];
	const serverPagination = data?.pagination ?? {
		page: 1,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	// Delete mutation
	const deleteMutation = useMutation({
		...studioPaymentsMutations.deleteSchedule(),
		onSuccess: () => {
			toast.success("Schedule deleted successfully");
			setDeleteDialogOpen(false);
			setScheduleToDelete(null);
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.payments.all,
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete schedule");
		},
	});

	// Define row actions (inline handlers to avoid stale closure issues)
	const rowActions: RowAction<PaymentScheduleListItem>[] = useMemo(
		() => [
			{
				label: "Edit",
				icon: <PencilIcon className="h-4 w-4" />,
				onClick: (row) => openEdit(row.id),
			},
			{
				label: "Delete",
				icon: <TrashIcon className="h-4 w-4" />,
				variant: "destructive",
				separator: true,
				onClick: (row) => {
					setScheduleToDelete(row);
					setDeleteDialogOpen(true);
				},
			},
		],
		[openEdit],
	);

	// Define columns with sortable headers and meta for filters
	const columns: ColumnDef<PaymentScheduleListItem>[] = useMemo(
		() => [
			createSelectColumn<PaymentScheduleListItem>(),
			{
				id: "booking",
				accessorKey: "bookingName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Booking" />
				),
				cell: ({ row }) => (
					<Link
						href={`/app/${organizationSlug}/bookings/${row.original.bookingId}`}
						className="text-muted-foreground hover:underline hover:text-foreground transition-colors"
					>
						{row.original.bookingName}
					</Link>
				),
				meta: {
					label: "Booking",
					width: 200,
					minWidth: 150,
					// Last left-sticky column - add right border
					headerClassName:
						"!border-r-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[0.5px] after:bg-table-border-subtle",
					cellClassName:
						"!border-r-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[0.5px] after:bg-table-border-subtle",
				},
				enableSorting: false,
				enableHiding: false,
			},
			{
				id: "name",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Schedule" />
				),
				cell: ({ row }) => (
					<span className="font-medium">{row.original.name}</span>
				),
				meta: {
					label: "Schedule",
					width: 160,
					minWidth: 160,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "dueDate",
				accessorKey: "dueDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Due Date" />
				),
				cell: ({ row }) => {
					const overdueCheck = isOverdue(
						row.original.dueDate,
						row.original.status,
					);
					return (
						<span
							className={
								overdueCheck
									? "text-destructive font-medium"
									: "text-muted-foreground"
							}
						>
							{formatDate(row.original.dueDate)}
						</span>
					);
				},
				meta: {
					label: "Due Date",
					icon: CalendarIcon,
					width: 140,
					minWidth: 120,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "amount",
				accessorKey: "amount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Amount" />
				),
				cell: ({ row }) => (
					<span className="font-semibold">
						{formatMoney(row.original.amount)}
					</span>
				),
				meta: {
					label: "Amount",
					width: 130,
					minWidth: 130,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "paid",
				accessorKey: "paidAmount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Paid" />
				),
				cell: ({ row }) => {
					const paid = Number(row.original.paidAmount);
					const total = Number(row.original.amount);
					const percentage = total > 0 ? (paid / total) * 100 : 0;
					const isComplete = paid >= total;

					return (
						<div className="flex flex-col gap-1">
							<span
								className={cn(
									"text-sm",
									isComplete
										? "text-green-600 dark:text-green-400"
										: "text-muted-foreground",
								)}
							>
								{formatMoney(row.original.paidAmount)} /{" "}
								{formatMoney(row.original.amount)}
							</span>
							<div className="h-1.5 w-20 rounded-full bg-muted">
								<div
									className={cn(
										"h-full rounded-full transition-all",
										isComplete
											? "bg-green-500"
											: "bg-primary",
									)}
									style={{
										width: `${Math.min(percentage, 100)}%`,
									}}
								/>
							</div>
						</div>
					);
				},
				meta: {
					label: "Paid",
					width: 150,
					minWidth: 150,
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
					const StatusIcon = STATUS_ICONS[status] ?? CircleDashedIcon;
					const isCompleted = status === "completed";

					return (
						<Badge
							variant={STATUS_VARIANTS[status]}
							className={cn(
								"gap-1",
								isCompleted &&
									"bg-green-100 text-green-700 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400",
							)}
						>
							<StatusIcon className="h-3 w-3" />
							{STATUS_LABELS[status]}
						</Badge>
					);
				},
				meta: {
					label: "Status",
					variant: "multiSelect" as const,
					icon: CircleDashedIcon,
					options: statusOptions,
					width: 130,
					minWidth: 130,
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
		[organizationSlug, rowActions],
	);

	return (
		<>
			<div className="space-y-4">
				<DataTableToolbarWithViews
					entityType="schedule"
					activeViewId={activeViewId}
					onViewSelect={(view: SavedView) => applyView(view)}
					getCurrentFilters={() => filters as Record<string, unknown>}
					getCurrentSorting={() => sortingState}
					getCurrentColumnVisibility={() => columnVisibility}
					filters={[
						{
							id: "status",
							label: "Status",
							variant: "multiSelect",
							options: statusOptions,
							icon: CircleDashedIcon,
						},
					]}
					filterValues={{
						status: filters.status ?? [],
					}}
					onFilterChange={(
						id: string,
						value:
							| string
							| string[]
							| { from?: string; to?: string }
							| null
							| undefined,
					) => {
						if (id === "status") {
							const values =
								Array.isArray(value) && value.length > 0
									? value
									: null;
							setFilter("status", values);
						}
					}}
					onResetFilters={resetFilters}
					isFiltered={isFiltered}
					showSearch
					searchValue={filters.search ?? ""}
					searchPlaceholder="Search schedules..."
					onSearchChange={(value: string) =>
						setFilter("search", value || null)
					}
					showViewOptions={false}
				/>

				{/* Table with sort context */}
				<SortProvider
					sortColumn={sorting.sortBy}
					sortDirection={sorting.sortDirection}
				>
					<DataTable
						columns={columns}
						data={schedules}
						isLoading={isLoading}
						isFetching={isFetching}
						pagination={serverPagination}
						onPaginationChange={onPaginationChange}
						onLimitChange={onLimitChange}
						sorting={sortingState}
						onSortingChange={onSortingChange}
						enableRowSelection
						getRowId={(row) => row.id}
						// Sticky columns configuration
						stickyLeftColumns={[
							{ id: "select", width: 48 },
							{ id: "booking", width: 200 },
						]}
						stickyRightColumns={[{ id: "actions", width: 48 }]}
						minWidth={1000}
						// Place scroll controls in the last sticky left column
						scrollControlsColumnId="booking"
						scrollStartColumn={2}
						emptyState={
							<div className="flex flex-col items-center gap-2">
								<CalendarClockIcon className="h-12 w-12 text-muted-foreground/50" />
								<p className="text-muted-foreground">
									No scheduled payments
								</p>
								<OpenScheduleCreateSheet
									variant="outline"
									size="sm"
									label="Add your first schedule"
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
						<AlertDialogTitle>Delete schedule?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the payment schedule "
							{scheduleToDelete?.name}" (
							{scheduleToDelete &&
								formatMoney(scheduleToDelete.amount)}
							) for "{scheduleToDelete?.bookingName}". This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (scheduleToDelete) {
									deleteMutation.mutate({
										id: scheduleToDelete.id,
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
