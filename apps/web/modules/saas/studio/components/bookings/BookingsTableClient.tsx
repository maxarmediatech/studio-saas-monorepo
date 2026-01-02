"use client";

import type { BookingListItem } from "@repo/api/modules/studio/schemas/booking";
import type { BookingPhase } from "@repo/api/modules/studio/schemas/common";
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
import { Button } from "@repo/ui/components/button";
import {
	DataTable,
	DataTableColumnHeader,
	DataTableRowActions,
	type RowAction,
} from "@saas/shared/components/data-table";
// Import types for column meta augmentation
import "@saas/shared/components/data-table/types";
import { useBookingsTable } from "@saas/studio/hooks/tables";
import {
	bookingsApi,
	bookingsMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CalendarIcon,
	EyeIcon,
	Loader2Icon,
	PencilIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface BookingsTableClientProps {
	organizationSlug: string;
}

const statusColors: Record<BookingPhase, string> = {
	new: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	preparation:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	shooting:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	delivery:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	cancelled:
		"bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const statusLabels: Record<BookingPhase, string> = {
	new: "New",
	preparation: "Preparation",
	shooting: "Shooting",
	delivery: "Delivery",
	completed: "Completed",
	cancelled: "Cancelled",
};

const formatMoney = (value: string) => {
	const num = Number.parseFloat(value);
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
	}).format(num);
};

export function BookingsTableClient({
	organizationSlug,
}: BookingsTableClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();

	// Use the bookings table hook for URL-synced state
	const {
		filters,
		pagination,
		sorting,
		sortingState,
		onSortingChange,
		onPaginationChange,
	} = useBookingsTable();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [bookingToDelete, setBookingToDelete] =
		useState<BookingListItem | null>(null);

	// Build query input from hook state
	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		status: filters.status ?? undefined,
		sortBy: sorting.sortBy ?? "createdAt",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	// Fetch bookings with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		bookingsApi.listOptions(queryInput),
	);

	const bookings = data?.data ?? [];
	const serverPagination = data?.pagination ?? {
		page: 1,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	// Delete mutation
	const deleteMutation = useMutation({
		...bookingsMutations.delete(),
		onSuccess: () => {
			toast.success("Booking deleted successfully");
			setDeleteDialogOpen(false);
			setBookingToDelete(null);
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.bookings.all,
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete booking");
		},
	});

	// Define row actions
	const rowActions: RowAction<BookingListItem>[] = useMemo(
		() => [
			{
				label: "View details",
				icon: <EyeIcon className="h-4 w-4" />,
				onClick: (row) =>
					router.push(`/app/${organizationSlug}/bookings/${row.id}`),
			},
			{
				label: "Edit",
				icon: <PencilIcon className="h-4 w-4" />,
				onClick: (row) =>
					router.push(
						`/app/${organizationSlug}/bookings/${row.id}/edit`,
					),
			},
			{
				label: "Delete",
				icon: <TrashIcon className="h-4 w-4" />,
				variant: "destructive",
				separator: true,
				onClick: (row) => {
					setBookingToDelete(row);
					setDeleteDialogOpen(true);
				},
			},
		],
		[organizationSlug, router],
	);

	// Define columns with sortable headers and meta for filters
	const columns: ColumnDef<BookingListItem>[] = useMemo(
		() => [
			{
				id: "referenceNumber",
				accessorKey: "referenceNumber",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Ref #" />
				),
				cell: ({ row }) => (
					<span className="font-mono text-sm">
						{row.original.referenceNumber}
					</span>
				),
				meta: {
					label: "Reference",
				},
				enableSorting: true,
				enableHiding: false,
			},
			{
				id: "name",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Name" />
				),
				cell: ({ row }) => (
					<div>
						<Link
							href={`/app/${organizationSlug}/bookings/${row.original.id}`}
							className="font-medium hover:underline"
						>
							{row.original.name}
						</Link>
						<p className="text-sm text-muted-foreground">
							{row.original.bookingType}
						</p>
					</div>
				),
				meta: {
					label: "Name",
				},
				enableSorting: true,
				enableHiding: false,
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
							statusColors[row.original.status as BookingPhase]
						}
					>
						{statusLabels[row.original.status as BookingPhase] ??
							row.original.status}
					</Badge>
				),
				meta: {
					label: "Status",
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "packageType",
				accessorKey: "packageType",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Package" />
				),
				meta: {
					label: "Package",
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "packageCost",
				accessorKey: "packageCost",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Value"
						className="justify-end"
					/>
				),
				cell: ({ row }) => (
					<div className="text-right font-medium">
						{formatMoney(row.original.packageCost)}
					</div>
				),
				meta: {
					label: "Value",
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "balance",
				accessorKey: "balance",
				header: () => <div className="text-right">Balance</div>,
				cell: ({ row }) => (
					<div className="text-right">
						<span
							className={
								Number.parseFloat(row.original.balance) > 0
									? "text-amber-600 dark:text-amber-400"
									: "text-green-600 dark:text-green-400"
							}
						>
							{formatMoney(row.original.balance)}
						</span>
					</div>
				),
				meta: {
					label: "Balance",
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "createdAt",
				accessorKey: "createdAt",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Created" />
				),
				cell: ({ row }) => {
					const date = new Date(row.original.createdAt);
					return (
						<span className="text-sm text-muted-foreground">
							{date.toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
								year: "numeric",
							})}
						</span>
					);
				},
				meta: {
					label: "Created",
					icon: CalendarIcon,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "shootsCount",
				accessorKey: "shootsCount",
				header: () => <div className="text-center">Shoots</div>,
				cell: ({ row }) => (
					<div className="text-center">
						{row.original.shootsCount}
					</div>
				),
				meta: {
					label: "Shoots",
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "actions",
				cell: ({ row }) => (
					<DataTableRowActions
						row={row.original}
						actions={rowActions}
					/>
				),
				enableSorting: false,
				enableHiding: false,
			},
		],
		[organizationSlug, rowActions],
	);

	return (
		<>
			<DataTable
				columns={columns}
				data={bookings}
				isLoading={isLoading}
				isFetching={isFetching}
				pagination={serverPagination}
				onPaginationChange={onPaginationChange}
				sorting={sortingState}
				onSortingChange={onSortingChange}
				emptyState={
					<div className="flex flex-col items-center gap-2">
						<p className="text-muted-foreground">
							No bookings found
						</p>
						<Button variant="outline" size="sm" asChild>
							<Link
								href={`/app/${organizationSlug}/bookings/new`}
							>
								<PlusIcon className="mr-2 h-4 w-4" />
								Create your first booking
							</Link>
						</Button>
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
						<AlertDialogTitle>Delete booking?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "
							{bookingToDelete?.name}" (
							{bookingToDelete?.referenceNumber}). This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (bookingToDelete) {
									deleteMutation.mutate({
										id: bookingToDelete.id,
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
