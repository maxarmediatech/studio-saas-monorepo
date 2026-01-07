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
import { useBookingParams } from "@saas/studio/hooks/params";
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
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface BookingsTableClientProps {
	organizationSlug: string;
}

export function BookingsTableClient({
	organizationSlug,
}: BookingsTableClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { openView } = useBookingParams();

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
		[openView, organizationSlug, router],
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
					width: 128,
					minWidth: 128,
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
					<div className="flex flex-col gap-0.5 leading-none">
						<Link
							href={`/app/${organizationSlug}/bookings/${row.original.id}`}
							className="text-sm font-medium text-foreground hover:underline"
						>
							{row.original.name}
						</Link>
						<span className="text-xs text-muted-foreground">
							{bookingTypeLabels.get(row.original.bookingType) ??
								row.original.bookingType}
						</span>
					</div>
				),
				meta: {
					label: "Name",
					variant: "text" as const,
					placeholder: "Search names...",
					icon: TextIcon,
					filterColumnId: "bookingType",
					filterVariant: "multiSelect" as const,
					filterIcon: TagIcon,
					filterLabel: "Booking Type",
					filterOptions: (bookingTypesData?.data ?? []).map(
						(config) => ({
							value: config.key,
							label: config.label,
						}),
					),
					width: 192,
					minWidth: 192,
					headerClassName:
						"!border-r-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border",
					cellClassName:
						"!border-r-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border",
				},
				enableSorting: true,
				enableHiding: false,
			},
			{
				id: "packageType",
				accessorKey: "packageType",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Package" />
				),
				cell: ({ row }) => (
					<div className="flex flex-col gap-0.5 leading-none">
						<span className="text-sm font-medium text-foreground">
							{packageTypeLabels.get(row.original.packageType) ??
								row.original.packageType}
						</span>
						<span className="text-xs text-muted-foreground tabular-nums">
							{formatMoney(row.original.packageCost)}
						</span>
					</div>
				),
				meta: {
					label: "Package",
					variant: "multiSelect" as const,
					icon: PackageIcon,
					options: (packageTypesData?.data ?? []).map((config) => ({
						value: config.key,
						label: config.label,
					})),
					width: 128,
					minWidth: 128,
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
					width: 96,
					minWidth: 96,
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
				cell: ({ row }) => {
					const count = row.original.shootsCount;
					return (
						<div className="flex items-center gap-2">
							<CameraIcon className="h-4 w-4 text-muted-foreground" />
							<span className="tabular-nums">
								{count} {count === 1 ? "shoot" : "shoots"}
							</span>
						</div>
					);
				},
				meta: {
					label: "Shoots",
					icon: CameraIcon,
					width: 100,
					minWidth: 100,
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
						return (
							<span className="text-muted-foreground">
								No clients
							</span>
						);
					}

					const MAX_VISIBLE = 2;
					const visible = participants.slice(0, MAX_VISIBLE);
					const hiddenCount = participants.length - visible.length;

					return (
						<div className="flex flex-wrap items-center gap-1">
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
												+{hiddenCount} more
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
					width: 180,
					minWidth: 180,
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
						{ id: "select", width: 48 },
						{ id: "createdAt", width: 128 },
						{ id: "name", width: 176 },
					]}
					stickyRightColumns={[{ id: "actions", width: 48 }]}
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
