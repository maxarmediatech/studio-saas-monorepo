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
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import {
	DataTable,
	DataTableRowActions,
	type RowAction,
} from "@saas/shared/components/data-table";
import { formatMoney } from "@saas/shared/lib";
import {
	bookingsApi,
	bookingsMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	EyeIcon,
	Loader2Icon,
	PencilIcon,
	PlusIcon,
	SearchIcon,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

interface BookingsPageClientProps {
	organizationSlug: string;
	initialFilters: {
		page: number;
		search?: string;
		status?: BookingPhase;
	};
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

export function BookingsPageClient({
	organizationSlug,
	initialFilters,
}: BookingsPageClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isPending, startTransition] = useTransition();

	const [searchValue, setSearchValue] = useState(initialFilters.search ?? "");
	const [currentFilters, setCurrentFilters] = useState(initialFilters);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [bookingToDelete, setBookingToDelete] =
		useState<BookingListItem | null>(null);

	// Build query input
	const queryInput = {
		page: currentFilters.page,
		limit: 10,
		search: currentFilters.search,
		status: currentFilters.status,
		sortBy: "createdAt",
		sortDirection: "desc" as const,
		includeDeleted: false,
	};

	// Fetch bookings with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		bookingsApi.listOptions(queryInput),
	);

	const bookings = data?.data ?? [];
	const pagination = data?.pagination ?? {
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
		if (newFilters.status) {
			params.set("status", newFilters.status);
		}

		const queryString = params.toString();
		const url = `/app/${organizationSlug}/bookings${queryString ? `?${queryString}` : ""}`;

		startTransition(() => {
			router.push(url, { scroll: false });
		});
	};

	const handleSearch = () => {
		updateFilters({ search: searchValue || undefined, page: 1 });
	};

	const handleStatusChange = (value: string) => {
		updateFilters({
			status: value === "all" ? undefined : (value as BookingPhase),
			page: 1,
		});
	};

	const handlePaginationChange = (newPagination: typeof pagination) => {
		updateFilters({ page: newPagination.page });
	};

	// Define row actions
	const rowActions: RowAction<BookingListItem>[] = [
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
				router.push(`/app/${organizationSlug}/bookings/${row.id}/edit`),
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
	];

	// Define columns
	const columns: ColumnDef<BookingListItem>[] = useMemo(
		() => [
			{
				accessorKey: "referenceNumber",
				header: "Ref #",
				cell: ({ row }) => (
					<span className="font-mono text-sm">
						{row.original.referenceNumber}
					</span>
				),
			},
			{
				accessorKey: "name",
				header: "Name",
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
			},
			{
				accessorKey: "status",
				header: "Status",
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
			},
			{
				accessorKey: "packageType",
				header: "Package",
			},
			{
				accessorKey: "packageCost",
				header: () => <div className="text-right">Value</div>,
				cell: ({ row }) => (
					<div className="text-right font-medium">
						{formatMoney(row.original.packageCost)}
					</div>
				),
			},
			{
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
			},
			{
				accessorKey: "shootsCount",
				header: () => <div className="text-center">Shoots</div>,
				cell: ({ row }) => (
					<div className="text-center">
						{row.original.shootsCount}
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
		[organizationSlug],
	);

	const showLoading = isFetching || isPending;

	return (
		<div className="space-y-4">
			{/* Filters */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
				<div className="relative flex-1 max-w-sm">
					<SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search bookings..."
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleSearch()}
						className="pl-9"
					/>
				</div>

				<Select
					value={currentFilters.status ?? "all"}
					onValueChange={handleStatusChange}
				>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="All statuses" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="new">New</SelectItem>
						<SelectItem value="preparation">Preparation</SelectItem>
						<SelectItem value="shooting">Shooting</SelectItem>
						<SelectItem value="delivery">Delivery</SelectItem>
						<SelectItem value="completed">Completed</SelectItem>
						<SelectItem value="cancelled">Cancelled</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Table */}
			<DataTable
				columns={columns}
				data={bookings}
				isLoading={isLoading}
				isFetching={showLoading}
				pagination={pagination}
				onPaginationChange={handlePaginationChange}
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
		</div>
	);
}
