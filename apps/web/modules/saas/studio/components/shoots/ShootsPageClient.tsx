"use client";

import type { ShootListItem } from "@repo/api/modules/studio/schemas/shoot";
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
import { useShootParams } from "@saas/studio/hooks/params/use-shoot-params";
import { bookingsApi, shootsApi, shootsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CalendarIcon,
	CameraIcon,
	Loader2Icon,
	MapPinIcon,
	PencilIcon,
	SearchIcon,
	TrashIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { OpenShootCreateSheet } from "./OpenShootSheet";

// Helper to format shoot type for display
function formatShootType(type: string): string {
	return type
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

// Helper to format date
function formatDate(dateStr: string): string {
	try {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-IN", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	} catch {
		return dateStr;
	}
}

interface ShootsPageClientProps {
	organizationSlug: string;
	initialFilters: {
		page: number;
		search?: string;
		bookingId?: string;
	};
}

export function ShootsPageClient({
	organizationSlug,
	initialFilters,
}: ShootsPageClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isPending, startTransition] = useTransition();

	const [searchValue, setSearchValue] = useState(initialFilters.search ?? "");
	const [currentFilters, setCurrentFilters] = useState(initialFilters);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [shootToDelete, setShootToDelete] = useState<ShootListItem | null>(
		null,
	);

	// URL-based sheet params
	const { openEdit } = useShootParams();

	// Fetch bookings for filter dropdown
	const { data: bookingsData } = useQuery(bookingsApi.listMinimalOptions({}));
	const bookings = bookingsData?.data ?? [];

	// Build query input
	const queryInput = {
		page: currentFilters.page,
		limit: 10,
		search: currentFilters.search,
		bookingId: currentFilters.bookingId,
		sortBy: "shootDate" as const,
		sortDirection: "desc" as const,
		includeDeleted: false,
	};

	// Fetch shoots with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		shootsApi.listOptions(queryInput),
	);

	const shoots = data?.data ?? [];
	const pagination = data?.pagination ?? {
		page: 1,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	// Delete mutation
	const deleteMutation = useMutation({
		...shootsMutations.delete(),
		onSuccess: () => {
			toast.success("Shoot deleted successfully");
			setDeleteDialogOpen(false);
			setShootToDelete(null);
			queryClient.invalidateQueries({
				queryKey: orpc.shoots.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete shoot");
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
		if (newFilters.bookingId) {
			params.set("bookingId", newFilters.bookingId);
		}

		const queryString = params.toString();
		const url = `/app/${organizationSlug}/shoots${queryString ? `?${queryString}` : ""}`;

		startTransition(() => {
			router.push(url, { scroll: false });
		});
	};

	const handleSearch = () => {
		updateFilters({ search: searchValue || undefined, page: 1 });
	};

	const handleBookingFilterChange = (value: string) => {
		updateFilters({
			bookingId: value === "all" ? undefined : value,
			page: 1,
		});
	};

	const handlePaginationChange = (newPagination: typeof pagination) => {
		updateFilters({ page: newPagination.page });
	};

	const handleOpenEdit = (shoot: ShootListItem) => {
		openEdit(shoot.id);
	};

	// Define row actions
	const rowActions: RowAction<ShootListItem>[] = [
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
				setShootToDelete(row);
				setDeleteDialogOpen(true);
			},
		},
	];

	// Define columns
	const columns: ColumnDef<ShootListItem>[] = useMemo(
		() => [
			{
				accessorKey: "name",
				header: "Name",
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
							<CameraIcon className="h-4 w-4 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium">{row.original.name}</p>
							<p className="text-xs text-muted-foreground">
								{row.original.bookingReferenceNumber}
							</p>
						</div>
					</div>
				),
			},
			{
				accessorKey: "bookingName",
				header: "Booking",
				cell: ({ row }) => (
					<Link
						href={`/app/${organizationSlug}/bookings/${row.original.bookingId}`}
						className="text-primary hover:underline"
					>
						{row.original.bookingName}
					</Link>
				),
			},
			{
				accessorKey: "shootType",
				header: "Type",
				cell: ({ row }) => (
					<Badge variant="secondary">
						{formatShootType(row.original.shootType)}
					</Badge>
				),
			},
			{
				accessorKey: "shootDate",
				header: "Date",
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<CalendarIcon className="h-4 w-4 text-muted-foreground" />
						<span>{formatDate(row.original.shootDate)}</span>
					</div>
				),
			},
			{
				accessorKey: "venue",
				header: "Venue",
				cell: ({ row }) => (
					<div className="flex items-center gap-2 max-w-[200px]">
						{row.original.venue ? (
							<>
								<MapPinIcon className="h-4 w-4 text-muted-foreground shrink-0" />
								<span className="truncate">
									{row.original.venue}
								</span>
							</>
						) : (
							<span className="text-muted-foreground">-</span>
						)}
					</div>
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
						placeholder="Search shoots..."
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleSearch()}
						className="pl-9"
					/>
				</div>

				<div className="w-full sm:w-[200px]">
					<Select
						value={currentFilters.bookingId ?? "all"}
						onValueChange={handleBookingFilterChange}
					>
						<SelectTrigger>
							<SelectValue placeholder="Filter by booking" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Bookings</SelectItem>
							{bookings.map((booking) => (
								<SelectItem key={booking.id} value={booking.id}>
									{booking.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="ml-auto">
					<OpenShootCreateSheet />
				</div>
			</div>

			{/* Table */}
			<DataTable
				columns={columns}
				data={shoots}
				isLoading={isLoading}
				isFetching={showLoading}
				pagination={pagination}
				onPaginationChange={handlePaginationChange}
				emptyState={
					<div className="flex flex-col items-center gap-2">
						<CameraIcon className="h-12 w-12 text-muted-foreground/50" />
						<p className="text-muted-foreground">No shoots found</p>
						<OpenShootCreateSheet
							variant="outline"
							size="sm"
							label="Add your first shoot"
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
						<AlertDialogTitle>Delete shoot?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{shootToDelete?.name}
							". This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (shootToDelete) {
									deleteMutation.mutate({
										id: shootToDelete.id,
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
