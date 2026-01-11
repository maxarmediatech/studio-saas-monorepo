"use client";

import type { TaskListItem } from "@repo/api/modules/studio/schemas/task";
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
import { orpc } from "@shared/lib/orpc-query-utils";
import { useTaskParams } from "@saas/studio/hooks/params/use-task-params";
import { useTasksTable } from "@saas/studio/hooks/tables";
import { tasksApi, tasksMutations } from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	AlertTriangleIcon,
	BookOpenIcon,
	CalendarIcon,
	CheckCircle2Icon,
	CircleIcon,
	ListTodoIcon,
	Loader2Icon,
	PencilIcon,
	PlayCircleIcon,
	TrashIcon,
	UsersIcon,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OpenTaskCreateSheet } from "./OpenTaskSheet";

// Note: organizationSlug kept for future task detail page navigation
interface TasksTableClientProps {
	organizationSlug?: string;
}

const statusOptions = [
	{ value: "pending", label: "Pending", icon: CircleIcon },
	{ value: "in_progress", label: "In Progress", icon: PlayCircleIcon },
	{ value: "completed", label: "Completed", icon: CheckCircle2Icon },
	{ value: "cancelled", label: "Cancelled", icon: XCircleIcon },
];

const priorityOptions = [
	{ value: "high", label: "High" },
	{ value: "medium", label: "Medium" },
	{ value: "low", label: "Low" },
];

function getPriorityBadge(priority: string) {
	const priorityLower = priority.toLowerCase();
	switch (priorityLower) {
		case "high":
			return <Badge variant="destructive">{priority}</Badge>;
		case "medium":
			return (
				<Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
					{priority}
				</Badge>
			);
		case "low":
			return <Badge variant="secondary">{priority}</Badge>;
		default:
			return <Badge variant="outline">{priority}</Badge>;
	}
}

function getStatusBadge(status: string) {
	const statusLower = status.toLowerCase();
	switch (statusLower) {
		case "completed":
			return (
				<Badge className="bg-green-500/10 text-green-600 border-green-500/20">
					<CheckCircle2Icon className="mr-1 h-3 w-3" />
					{status}
				</Badge>
			);
		case "in_progress":
			return (
				<Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
					<PlayCircleIcon className="mr-1 h-3 w-3" />
					{status.replace("_", " ")}
				</Badge>
			);
		case "pending":
			return (
				<Badge variant="secondary">
					<CircleIcon className="mr-1 h-3 w-3" />
					{status}
				</Badge>
			);
		case "cancelled":
			return (
				<Badge variant="outline">
					<XCircleIcon className="mr-1 h-3 w-3" />
					{status}
				</Badge>
			);
		default:
			return <Badge variant="outline">{status}</Badge>;
	}
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

function isOverdue(dateString: string | null, status: string): boolean {
	if (!dateString || status === "completed" || status === "cancelled") {
		return false;
	}
	const dueDate = new Date(dateString);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return dueDate < today;
}

export function TasksTableClient({
	organizationSlug,
}: TasksTableClientProps) {
	const queryClient = useQueryClient();

	// Use the tasks table hook for URL-synced state
	const {
		filters,
		pagination,
		sorting,
		sortingState,
		onSortingChange,
		onPaginationChange,
		onLimitChange,
	} = useTasksTable();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [taskToDelete, setTaskToDelete] = useState<TaskListItem | null>(null);

	// URL-based sheet params
	const { openEdit } = useTaskParams();

	// Build query input from hook state
	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		status: filters.status ?? undefined,
		priority: filters.priority ?? undefined,
		sortBy: sorting.sortBy ?? "dueDate",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	// Fetch tasks with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		tasksApi.listOptions(queryInput),
	);

	const tasks = data?.data ?? [];
	const serverPagination = data?.pagination ?? {
		page: 1,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	// Delete mutation
	const deleteMutation = useMutation({
		...tasksMutations.delete(),
		onSuccess: () => {
			toast.success("Task deleted successfully");
			setDeleteDialogOpen(false);
			setTaskToDelete(null);
			queryClient.invalidateQueries({
				queryKey: orpc.tasks.key(),
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete task");
		},
	});

	const handleOpenEdit = (task: TaskListItem) => {
		openEdit(task.id);
	};

	// Define row actions
	const rowActions: RowAction<TaskListItem>[] = useMemo(
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
					setTaskToDelete(row);
					setDeleteDialogOpen(true);
				},
			},
		],
		[],
	);

	// Define columns with sortable headers and meta for filters
	const columns: ColumnDef<TaskListItem>[] = useMemo(
		() => [
			createSelectColumn<TaskListItem>(),
			{
				id: "name",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Name" />
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
							<ListTodoIcon className="h-4 w-4 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium">{row.original.name}</p>
							{row.original.description && (
								<p className="text-sm text-muted-foreground line-clamp-1 max-w-[200px]">
									{row.original.description}
								</p>
							)}
						</div>
					</div>
				),
				meta: {
					label: "Name",
					width: 280,
					minWidth: 280,
					// Last left-sticky column - add right border
					headerClassName:
						"!border-r-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border",
					cellClassName:
						"!border-r-0 bg-table-surface group-data-[state=selected]:bg-table-row-selected z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border",
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
						className="flex items-center gap-2 hover:underline"
					>
						<BookOpenIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
						<div className="min-w-0">
							<p className="font-medium truncate">
								{row.original.bookingName}
							</p>
							<p className="text-xs text-muted-foreground">
								{row.original.bookingReferenceNumber}
							</p>
						</div>
					</Link>
				),
				meta: {
					label: "Booking",
					icon: BookOpenIcon,
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
				cell: ({ row }) => getStatusBadge(row.original.status),
				meta: {
					label: "Status",
					variant: "multiSelect" as const,
					icon: CircleIcon,
					options: statusOptions,
					width: 140,
					minWidth: 140,
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
				cell: ({ row }) => getPriorityBadge(row.original.priority),
				meta: {
					label: "Priority",
					variant: "multiSelect" as const,
					icon: AlertTriangleIcon,
					options: priorityOptions,
					width: 120,
					minWidth: 120,
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
					const overdue = isOverdue(dueDate, row.original.status);
					return (
						<div className="flex items-center gap-2">
							<CalendarIcon
								className={`h-4 w-4 ${overdue ? "text-destructive" : "text-muted-foreground"}`}
							/>
							<span
								className={
									overdue
										? "text-destructive font-medium"
										: ""
								}
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
				id: "assignmentsCount",
				accessorKey: "assignmentsCount",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Assignees"
						className="justify-center"
					/>
				),
				cell: ({ row }) => (
					<div className="flex items-center justify-center gap-2">
						<UsersIcon className="h-4 w-4 text-muted-foreground" />
						<span>{row.original.assignmentsCount}</span>
					</div>
				),
				meta: {
					label: "Assignees",
					icon: UsersIcon,
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
					// First right-sticky column - add left border + fade
					headerClassName:
						"!px-0 md:sticky md:right-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-gray-100",
					cellClassName:
						"!px-0 md:sticky md:right-0 bg-table-surface group-data-[state=selected]:bg-table-row-selected z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-table-surface group-data-[state=selected]:after:to-table-row-selected",
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
					data={tasks}
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
						{ id: "select", width: 56 },
						{ id: "name", width: 280 },
					]}
					stickyRightColumns={[{ id: "actions", width: 56 }]}
					minWidth={1100}
					// Place scroll controls in the last sticky left column
					scrollControlsColumnId="name"
					scrollStartColumn={2}
					emptyState={
						<div className="flex flex-col items-center gap-2">
							<ListTodoIcon className="h-12 w-12 text-muted-foreground/50" />
							<p className="text-muted-foreground">
								No tasks found
							</p>
							<OpenTaskCreateSheet
								variant="outline"
								size="sm"
								label="Add your first task"
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
						<AlertDialogTitle>Delete task?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{taskToDelete?.name}".
							This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (taskToDelete) {
									deleteMutation.mutate({
										id: taskToDelete.id,
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
