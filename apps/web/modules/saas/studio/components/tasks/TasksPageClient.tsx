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
import { Input } from "@repo/ui/components/input";
import {
	DataTable,
	DataTableRowActions,
	type RowAction,
} from "@saas/shared/components/data-table";
import { useTaskParams } from "@saas/studio/hooks/params/use-task-params";
import { tasksApi, tasksMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	BookOpenIcon,
	CalendarIcon,
	ListTodoIcon,
	Loader2Icon,
	PencilIcon,
	SearchIcon,
	TrashIcon,
	UsersIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { OpenTaskCreateSheet } from "./OpenTaskSheet";

interface TasksPageClientProps {
	organizationSlug: string;
	initialFilters: {
		page: number;
		search?: string;
	};
}

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
					{status}
				</Badge>
			);
		case "in_progress":
			return (
				<Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
					{status.replace("_", " ")}
				</Badge>
			);
		case "pending":
			return <Badge variant="secondary">{status}</Badge>;
		case "cancelled":
			return <Badge variant="outline">{status}</Badge>;
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

function isOverdue(dateString: string | null): boolean {
	if (!dateString) {
		return false;
	}
	const dueDate = new Date(dateString);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return dueDate < today;
}

export function TasksPageClient({
	organizationSlug,
	initialFilters,
}: TasksPageClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isPending, startTransition] = useTransition();

	const [searchValue, setSearchValue] = useState(initialFilters.search ?? "");
	const [currentFilters, setCurrentFilters] = useState(initialFilters);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [taskToDelete, setTaskToDelete] = useState<TaskListItem | null>(null);

	// URL-based sheet params
	const { openEdit } = useTaskParams();

	// Build query input
	const queryInput = {
		page: currentFilters.page,
		limit: 10,
		search: currentFilters.search,
		sortBy: "dueDate" as const,
		sortDirection: "asc" as const,
		includeDeleted: false,
	};

	// Fetch tasks with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		tasksApi.listOptions(queryInput),
	);

	const tasks = data?.data ?? [];
	const pagination = data?.pagination ?? {
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

	const updateFilters = (updates: Partial<typeof currentFilters>) => {
		const newFilters = { ...currentFilters, ...updates };
		setCurrentFilters(newFilters);

		const params = new URLSearchParams();
		if (newFilters.page > 1) {
			params.set("page", String(newFilters.page));
		}
		if (newFilters.search) {
			params.set("search", newFilters.search);
		}

		const queryString = params.toString();
		const url = `/app/${organizationSlug}/tasks${queryString ? `?${queryString}` : ""}`;

		startTransition(() => {
			router.push(url, { scroll: false });
		});
	};

	const handleSearch = () => {
		updateFilters({ search: searchValue || undefined, page: 1 });
	};

	const handlePaginationChange = (newPagination: typeof pagination) => {
		updateFilters({ page: newPagination.page });
	};

	const handleOpenEdit = (task: TaskListItem) => {
		openEdit(task.id);
	};

	// Define row actions
	const rowActions: RowAction<TaskListItem>[] = [
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
	];

	// Define columns
	const columns: ColumnDef<TaskListItem>[] = useMemo(
		() => [
			{
				accessorKey: "name",
				header: "Name",
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
							<ListTodoIcon className="h-4 w-4 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium">{row.original.name}</p>
						</div>
					</div>
				),
			},
			{
				accessorKey: "booking",
				header: "Booking",
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<BookOpenIcon className="h-4 w-4 text-muted-foreground" />
						<div>
							<p className="font-medium">
								{row.original.bookingName}
							</p>
							<p className="text-xs text-muted-foreground">
								{row.original.bookingReferenceNumber}
							</p>
						</div>
					</div>
				),
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => getStatusBadge(row.original.status),
			},
			{
				accessorKey: "priority",
				header: "Priority",
				cell: ({ row }) => getPriorityBadge(row.original.priority),
			},
			{
				accessorKey: "dueDate",
				header: "Due Date",
				cell: ({ row }) => {
					const dueDate = row.original.dueDate;
					const overdue = isOverdue(dueDate);
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
			},
			{
				accessorKey: "assignmentsCount",
				header: "Assignees",
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<UsersIcon className="h-4 w-4 text-muted-foreground" />
						<span>{row.original.assignmentsCount}</span>
					</div>
				),
			},
			{
				id: "actions",
				cell: ({ row }) => (
					<DataTableRowActions
						row={row.original}
						actions={rowActions}
					/>
				),
			},
		],
		[],
	);

	const showLoading = isFetching || isPending;

	return (
		<div className="space-y-4">
			{/* Filters */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
				<div className="relative flex-1 max-w-sm">
					<SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search tasks..."
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleSearch()}
						className="pl-9"
					/>
				</div>

				<div className="ml-auto">
					<OpenTaskCreateSheet />
				</div>
			</div>

			{/* Table */}
			<DataTable
				columns={columns}
				data={tasks}
				isLoading={isLoading}
				isFetching={showLoading}
				pagination={pagination}
				onPaginationChange={handlePaginationChange}
				emptyState={
					<div className="flex flex-col items-center gap-2">
						<ListTodoIcon className="h-12 w-12 text-muted-foreground/50" />
						<p className="text-muted-foreground">No tasks found</p>
						<OpenTaskCreateSheet
							variant="outline"
							size="sm"
							label="Add your first task"
						/>
					</div>
				}
			/>

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
		</div>
	);
}
