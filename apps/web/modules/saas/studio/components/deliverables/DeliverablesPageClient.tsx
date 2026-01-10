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
import { Input } from "@repo/ui/components/input";
import {
	DataTable,
	DataTableRowActions,
	type RowAction,
} from "@saas/shared/components/data-table";
import { useDeliverableParams } from "@saas/studio/hooks/params/use-deliverable-params";
import {
	deliverablesApi,
	deliverablesMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CalendarIcon,
	Loader2Icon,
	PackageIcon,
	PencilIcon,
	SearchIcon,
	TrashIcon,
	UsersIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { OpenDeliverableCreateSheet } from "./OpenDeliverableSheet";

function formatDate(dateString: string | null): string {
	if (!dateString) {
		return "-";
	}
	const date = new Date(dateString);
	return date.toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

function getStatusVariant(
	status: string,
): "default" | "secondary" | "destructive" | "outline" {
	const statusLower = status.toLowerCase();
	if (statusLower === "completed" || statusLower === "delivered") {
		return "default";
	}
	if (statusLower === "pending" || statusLower === "draft") {
		return "secondary";
	}
	if (statusLower === "overdue" || statusLower === "cancelled") {
		return "destructive";
	}
	return "outline";
}

interface DeliverablesPageClientProps {
	organizationSlug: string;
	initialFilters: {
		page: number;
		search?: string;
	};
}

export function DeliverablesPageClient({
	organizationSlug,
	initialFilters,
}: DeliverablesPageClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isPending, startTransition] = useTransition();

	const [searchValue, setSearchValue] = useState(initialFilters.search ?? "");
	const [currentFilters, setCurrentFilters] = useState(initialFilters);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deliverableToDelete, setDeliverableToDelete] =
		useState<DeliverableListItem | null>(null);

	// URL-based sheet params
	const { openEdit } = useDeliverableParams();

	// Build query input
	const queryInput = {
		page: currentFilters.page,
		limit: 10,
		search: currentFilters.search,
		sortBy: "dueDate" as const,
		sortDirection: "asc" as const,
		includeDeleted: false,
	};

	// Fetch deliverables with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		deliverablesApi.listOptions(queryInput),
	);

	const deliverables = data?.data ?? [];
	const pagination = data?.pagination ?? {
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
		const url = `/app/${organizationSlug}/deliverables${queryString ? `?${queryString}` : ""}`;

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

	const handleOpenEdit = (deliverable: DeliverableListItem) => {
		openEdit(deliverable.id);
	};

	// Define row actions
	const rowActions: RowAction<DeliverableListItem>[] = [
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
	];

	// Define columns
	const columns: ColumnDef<DeliverableListItem>[] = useMemo(
		() => [
			{
				accessorKey: "name",
				header: "Name",
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
							<PackageIcon className="h-4 w-4 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium">{row.original.name}</p>
							{row.original.description && (
								<p className="text-sm text-muted-foreground line-clamp-1">
									{row.original.description}
								</p>
							)}
						</div>
					</div>
				),
			},
			{
				accessorKey: "booking",
				header: "Booking",
				cell: ({ row }) => (
					<div>
						<p className="font-medium">
							{row.original.bookingName}
						</p>
						<p className="text-sm text-muted-foreground">
							{row.original.bookingReferenceNumber}
						</p>
					</div>
				),
			},
			{
				accessorKey: "dueDate",
				header: "Due Date",
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						{row.original.dueDate ? (
							<>
								<CalendarIcon className="h-4 w-4 text-muted-foreground" />
								<span>{formatDate(row.original.dueDate)}</span>
							</>
						) : (
							<span className="text-muted-foreground">-</span>
						)}
					</div>
				),
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => (
					<Badge variant={getStatusVariant(row.original.status)}>
						{row.original.status}
					</Badge>
				),
			},
			{
				accessorKey: "assignmentsCount",
				header: "Crew",
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
						placeholder="Search deliverables..."
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleSearch()}
						className="pl-9"
					/>
				</div>

				<div className="ml-auto">
					<OpenDeliverableCreateSheet />
				</div>
			</div>

			{/* Table */}
			<DataTable
				columns={columns}
				data={deliverables}
				isLoading={isLoading}
				isFetching={showLoading}
				pagination={pagination}
				onPaginationChange={handlePaginationChange}
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
		</div>
	);
}
