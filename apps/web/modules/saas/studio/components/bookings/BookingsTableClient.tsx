"use client";

import type { BookingListItem } from "@repo/api/modules/studio/schemas/booking";
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
import { Button } from "@repo/ui/components/button";
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
import { useBookingsTable } from "@saas/studio/hooks/tables";
import {
	bookingsApi,
	bookingsMutations,
	configurationsApi,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CalendarIcon,
	EyeIcon,
	Loader2Icon,
	PackageIcon,
	PencilIcon,
	PlusIcon,
	TagIcon,
	TextIcon,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface BookingsTableClientProps {
	organizationSlug: string;
}

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
	// Convert array filters to comma-separated strings for API
	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		statuses: filters.statuses ?? undefined,
		bookingType: filters.bookingType?.join(",") ?? undefined,
		packageType: filters.packageType?.join(",") ?? undefined,
		createdAt: filters.createdAt?.join(",") ?? undefined,
		sortBy: sorting.sortBy ?? "createdAt",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	// Fetch bookings with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		bookingsApi.listOptions(queryInput),
	);

	// Fetch configurations for labels
	const { data: bookingTypesData } = useQuery(
		configurationsApi.bookingTypesOptions(),
	);
	const { data: packageTypesData } = useQuery(
		configurationsApi.packageTypesOptions(),
	);

	// Create lookup maps for key -> label
	const bookingTypeLabels = useMemo(() => {
		const map = new Map<string, string>();
		for (const config of bookingTypesData?.data ?? []) {
			map.set(config.key, config.label);
		}
		return map;
	}, [bookingTypesData]);

	const packageTypeLabels = useMemo(() => {
		const map = new Map<string, string>();
		for (const config of packageTypesData?.data ?? []) {
			map.set(config.key, config.label);
		}
		return map;
	}, [packageTypesData]);

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
	// Column order: select → createdAt → name → bookingType → packageType → packageCost → balance → actions
	const columns: ColumnDef<BookingListItem>[] = useMemo(
		() => [
			createSelectColumn<BookingListItem>(),
			{
				id: "createdAt",
				accessorKey: "createdAt",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Date" />
				),
				cell: ({ row }) => {
					const date = new Date(row.original.createdAt);
					return (
						<div className="flex flex-col gap-0.5 leading-none">
							<span className="text-sm font-medium text-foreground">
								{date.toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
									year: "numeric",
								})}
							</span>
							<span className="font-mono text-xs text-muted-foreground">
								{row.original.referenceNumber}
							</span>
						</div>
					);
				},
				meta: {
					label: "Created",
					variant: "dateRange" as const,
					icon: CalendarIcon,
					width: 160,
					minWidth: 160,
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
					<Link
						href={`/app/${organizationSlug}/bookings/${row.original.id}`}
						className="font-medium text-foreground hover:underline"
					>
						{row.original.name}
					</Link>
				),
				meta: {
					label: "Name",
					variant: "text" as const,
					placeholder: "Search names...",
					icon: TextIcon,
					width: 180,
					minWidth: 180,
					headerClassName:
						"!border-r-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border",
					cellClassName:
						"!border-r-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border",
				},
				enableSorting: true,
				enableHiding: false,
			},
			{
				id: "bookingType",
				accessorKey: "bookingType",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Type" />
				),
				cell: ({ row }) => (
					<span className="text-sm">
						{bookingTypeLabels.get(row.original.bookingType) ??
							row.original.bookingType}
					</span>
				),
				meta: {
					label: "Booking Type",
					variant: "multiSelect" as const,
					icon: TagIcon,
					options: (bookingTypesData?.data ?? []).map((config) => ({
						value: config.key,
						label: config.label,
					})),
					width: 120,
					minWidth: 120,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "packageType",
				accessorKey: "packageType",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Package" />
				),
				cell: ({ row }) => (
					<span className="text-sm">
						{packageTypeLabels.get(row.original.packageType) ??
							row.original.packageType}
					</span>
				),
				meta: {
					label: "Package",
					variant: "multiSelect" as const,
					icon: PackageIcon,
					options: (packageTypesData?.data ?? []).map((config) => ({
						value: config.key,
						label: config.label,
					})),
					width: 160,
					minWidth: 160,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "packageCost",
				accessorKey: "packageCost",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Cost"
						className="justify-end"
					/>
				),
				cell: ({ row }) => (
					<div className="text-right font-semibold tabular-nums">
						{formatMoney(row.original.packageCost)}
					</div>
				),
				meta: {
					label: "Cost",
					width: 120,
					minWidth: 120,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "balance",
				accessorKey: "balance",
				header: () => (
					<span className="text-foreground flex h-8 items-center justify-end text-xs font-semibold uppercase tracking-wide">
						Balance
					</span>
				),
				cell: ({ row }) => (
					<div className="text-right font-semibold tabular-nums">
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
					width: 120,
					minWidth: 120,
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
					headerClassName:
						"!px-0 md:sticky md:right-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-background",
					cellClassName:
						"!px-0 md:sticky md:right-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-background",
				},
			},
		],
		[
			organizationSlug,
			rowActions,
			bookingTypeLabels,
			packageTypeLabels,
			bookingTypesData,
			packageTypesData,
		],
	);

	return (
		<>
			<SortProvider
				sortColumn={sorting.sortBy}
				sortDirection={sorting.sortDirection}
			>
				<DataTable
					columns={columns}
					data={bookings}
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
						{ id: "createdAt", width: 160 },
						{ id: "name", width: 180 },
					]}
					stickyRightColumns={[{ id: "actions", width: 56 }]}
					minWidth={1200}
					// Place scroll controls in the last sticky left column
					scrollControlsColumnId="name"
					scrollStartColumn={3}
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
			</SortProvider>

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
