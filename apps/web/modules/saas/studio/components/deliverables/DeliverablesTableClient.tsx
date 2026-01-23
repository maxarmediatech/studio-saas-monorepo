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
	DataTableViewOptions,
	type RowAction,
	SortProvider,
} from "@saas/shared/components/data-table";
// Import types for column meta augmentation
import "@saas/shared/components/data-table/types";
import { formatMoney } from "@saas/shared/lib";
import { useDeliverableParams } from "@saas/studio/hooks/params/use-deliverable-params";
import { useDeliverablesTable } from "@saas/studio/hooks/tables";
import {
	configurationsApi,
	deliverablesApi,
	deliverablesMutations,
} from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CalendarIcon,
	CheckCircleIcon,
	CircleIcon,
	ClockIcon,
	EyeIcon,
	Loader2Icon,
	PackageIcon,
	PencilIcon,
	TrashIcon,
	TruckIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OpenDeliverableCreateSheet } from "./OpenDeliverableSheet";

interface DeliverablesTableClientProps {
	organizationSlug: string;
}

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

export function DeliverablesTableClient({
	organizationSlug,
}: DeliverablesTableClientProps) {
	const queryClient = useQueryClient();
	const router = useRouter();

	// Use the deliverables table hook for URL-synced state
	const {
		filters,
		pagination,
		sorting,
		sortingState,
		onSortingChange,
		onPaginationChange,
		onLimitChange,
	} = useDeliverablesTable();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deliverableToDelete, setDeliverableToDelete] =
		useState<DeliverableListItem | null>(null);

	// URL-based sheet params
	const { openEdit } = useDeliverableParams();

	// Build query input from hook state
	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		status: filters.status ?? undefined,
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

	// Fetch configurations for labels
	const { data: packageTypesData } = useQuery(
		configurationsApi.packageTypesOptions(),
	);

	const packageTypeLabels = useMemo(() => {
		const map = new Map<string, string>();
		for (const config of packageTypesData?.data ?? []) {
			map.set(config.key, config.label);
		}
		return map;
	}, [packageTypesData]);

	// Delete mutation
	const deleteMutation = useMutation({
		...deliverablesMutations.delete(),
		onSuccess: () => {
			toast.success("Deliverable deleted successfully");
			setDeleteDialogOpen(false);
			setDeliverableToDelete(null);
			queryClient.invalidateQueries({
				queryKey: orpc.deliverables.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete deliverable");
		},
	});

	const handleOpenEdit = (deliverable: DeliverableListItem) => {
		openEdit(deliverable.id);
	};

	const rowActions: RowAction<DeliverableListItem>[] = useMemo(
		() => [
			{
				label: "View details",
				icon: <EyeIcon className="h-4 w-4" />,
				onClick: (row) =>
					router.push(
						`/app/${organizationSlug}/deliverables/${row.id}`,
					),
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
					setDeliverableToDelete(row);
					setDeleteDialogOpen(true);
				},
			},
		],
		[organizationSlug, router],
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
					<Link
						href={`/app/${organizationSlug}/deliverables/${row.original.id}`}
						className="font-medium text-foreground hover:underline"
					>
						{row.original.name}
					</Link>
				),
				meta: {
					label: "Name",
					width: 240,
					minWidth: 200,
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
					const dueDate = row.original.dueDate;
					const isOverdue =
						dueDate &&
						new Date(dueDate) < new Date() &&
						row.original.status !== "completed" &&
						row.original.status !== "delivered";

					if (!dueDate) {
						return <span className="text-muted-foreground">—</span>;
					}

					return (
						<span
							className={
								isOverdue
									? "text-destructive font-medium"
									: "text-muted-foreground"
							}
						>
							{formatDate(dueDate)}
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
					width: 140,
					minWidth: 140,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "assignmentsCount",
				accessorKey: "assignmentsCount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Crew" />
				),
				cell: ({ row }) => (
					<span className="tabular-nums">
						{row.original.assignmentsCount}
					</span>
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
				id: "packageType",
				accessorKey: "bookingPackageType",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Package Type"
					/>
				),
				cell: ({ row }) => (
					<span className="capitalize">
						{packageTypeLabels.get(
							row.original.bookingPackageType,
						) ?? row.original.bookingPackageType}
					</span>
				),
				meta: {
					label: "Package Type",
					width: 140,
					minWidth: 120,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "cost",
				accessorKey: "cost",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Cost" />
				),
				cell: ({ row }) => {
					if (row.original.isPackageIncluded) {
						return <Badge variant="secondary">Included</Badge>;
					}
					return (
						<span>
							{row.original.cost
								? formatMoney(row.original.cost)
								: "—"}
						</span>
					);
				},
				meta: {
					label: "Cost",
					width: 100,
					minWidth: 100,
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
					onLimitChange={onLimitChange}
					sorting={sortingState}
					onSortingChange={onSortingChange}
					enableRowSelection
					getRowId={(row) => row.id}
					// Sticky columns configuration
					stickyLeftColumns={[
						{ id: "select", width: 48 },
						{ id: "name", width: 240 },
					]}
					stickyRightColumns={[{ id: "actions", width: 48 }]}
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
