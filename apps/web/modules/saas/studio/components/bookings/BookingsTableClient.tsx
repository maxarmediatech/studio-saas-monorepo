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
import { Badge } from "@repo/ui/components/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { formatMoney } from "@saas/shared/lib";
import {
	useBookingEditParams,
	useBookingParams,
} from "@saas/studio/hooks/params";
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
	CameraIcon,
	EyeIcon,
	Loader2Icon,
	PackageIcon,
	PencilIcon,
	PlusIcon,
	TagIcon,
	TextIcon,
	TrashIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface BookingsTableClientProps {
	organizationSlug: string;
}

export function BookingsTableClient({
	organizationSlug,
}: BookingsTableClientProps) {
	const queryClient = useQueryClient();
	const { openView } = useBookingParams();
	const { openEdit } = useBookingEditParams();

	// Use the bookings table hook for URL-synced state
	const {
		filters,
		pagination,
		sorting,
		sortingState,
		onSortingChange,
		onPaginationChange,
		onLimitChange,
	} = useBookingsTable();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [bookingToDelete, setBookingToDelete] =
		useState<BookingListItem | null>(null);

	// Build query input from hook state
	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		statuses: filters.statuses ?? undefined,
		bookingType: filters.bookingType ?? undefined,
		packageType: filters.packageType ?? undefined,
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
				onClick: (row) => openView(row.id),
			},
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
					setBookingToDelete(row);
					setDeleteDialogOpen(true);
				},
			},
		],
		[openView, openEdit],
	);

	const columns: ColumnDef<BookingListItem>[] = useMemo(
		() => [
			createSelectColumn<BookingListItem>(),
			{
				id: "referenceNumber",
				accessorKey: "referenceNumber",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="ID" />
				),
				cell: ({ row }) => (
					<span className="font-mono text-muted-foreground">
						{row.original.referenceNumber}
					</span>
				),
				meta: {
					label: "ID",
					width: 120,
					minWidth: 120,
					headerClassName:
						"!border-r-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle",
					cellClassName:
						"!border-r-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle",
				},
				enableSorting: false,
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
					width: 240,
					minWidth: 200,
					headerClassName:
						"!border-r-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[0.5px] after:bg-table-border-subtle",
					cellClassName:
						"!border-r-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[0.5px] after:bg-table-border-subtle",
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
					<span className="text-muted-foreground">
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
					width: 100,
					minWidth: 100,
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
					<span>
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
					minWidth: 140,
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
					<span className="tabular-nums text-right block">
						{formatMoney(row.original.packageCost)}
					</span>
				),
				meta: {
					label: "Package Cost",
					width: 100,
					minWidth: 100,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "balance",
				accessorKey: "balance",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Balance"
						className="justify-end"
					/>
				),
				cell: ({ row }) => (
					<span
						className={`tabular-nums text-right block font-medium ${
							Number.parseFloat(row.original.balance) > 0
								? "text-amber-600 dark:text-amber-400"
								: "text-green-600 dark:text-green-400"
						}`}
					>
						{formatMoney(row.original.balance)}
					</span>
				),
				meta: {
					label: "Balance",
					width: 100,
					minWidth: 100,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "shoots",
				accessorKey: "shootsCount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Shoots" />
				),
				cell: ({ row }) => (
					<span className="tabular-nums">
						{row.original.shootsCount}
					</span>
				),
				meta: {
					label: "Shoots",
					icon: CameraIcon,
					width: 80,
					minWidth: 80,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "participants",
				accessorKey: "participants",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Clients" />
				),
				cell: ({ row }) => {
					const participants = row.original.participants || [];

					if (!participants.length) {
						return <span className="text-muted-foreground">—</span>;
					}

					const MAX_VISIBLE = 2;
					const visible = participants.slice(0, MAX_VISIBLE);
					const hiddenCount = participants.length - visible.length;

					return (
						<div className="flex items-center gap-1">
							{visible.map((participant) => (
								<Badge
									key={participant.id}
									variant="secondary"
									className="capitalize"
								>
									{participant.client.name}
								</Badge>
							))}
							{hiddenCount > 0 && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Badge variant="outline">
												+{hiddenCount}
											</Badge>
										</TooltipTrigger>
										<TooltipContent side="top">
											<div className="space-y-1">
												{participants.map(
													(participant) => (
														<div
															key={participant.id}
															className="text-sm"
														>
															{
																participant
																	.client.name
															}
														</div>
													),
												)}
											</div>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
						</div>
					);
				},
				meta: {
					label: "Clients",
					icon: UsersIcon,
					width: 160,
					minWidth: 140,
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
					label: "Created",
					variant: "dateRange" as const,
					icon: CalendarIcon,
					width: 110,
					minWidth: 110,
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
					headerClassName:
						"!px-0 md:sticky md:right-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-gray-100",
					cellClassName:
						"!px-0 md:sticky md:right-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-table-surface group-data-[state=selected]:after:to-table-row-selected",
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
					onLimitChange={onLimitChange}
					sorting={sortingState}
					onSortingChange={onSortingChange}
					enableRowSelection
					getRowId={(row) => row.id}
					stickyLeftColumns={[
						{ id: "select", width: 48 },
						{ id: "referenceNumber", width: 120 },
						{ id: "name", width: 240 },
					]}
					stickyRightColumns={[{ id: "actions", width: 48 }]}
					minWidth={1400}
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
