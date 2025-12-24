"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
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
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	MoreHorizontalIcon,
	PencilIcon,
	TrashIcon,
	EyeIcon,
	PlusIcon,
	SearchIcon,
	Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { bookingsApi, bookingsMutations, studioQueryKeys } from "@saas/studio/lib/api";
import type { BookingListItem } from "@repo/api/modules/studio/schemas/booking";
import type { BookingPhase } from "@repo/api/modules/studio/schemas/common";

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
	preparation: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	shooting: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	delivery: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
	completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
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
	const [bookingToDelete, setBookingToDelete] = useState<BookingListItem | null>(null);

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
	const { data, isLoading, isFetching } = useQuery(bookingsApi.listOptions(queryInput));

	const bookings = data?.data ?? [];
	const pagination = data?.pagination ?? { page: 1, limit: 10, total: 0, pageCount: 0 };

	// Delete mutation
	const deleteMutation = useMutation({
		...bookingsMutations.delete(),
		onSuccess: () => {
			toast.success("Booking deleted successfully");
			setDeleteDialogOpen(false);
			setBookingToDelete(null);
			// Invalidate bookings queries to refetch
			queryClient.invalidateQueries({ queryKey: studioQueryKeys.bookings.all });
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete booking");
		},
	});

	const updateFilters = (updates: Partial<typeof currentFilters>) => {
		const newFilters = { ...currentFilters, ...updates };
		setCurrentFilters(newFilters);

		// Update URL params
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

	const handlePageChange = (newPage: number) => {
		updateFilters({ page: newPage });
	};

	const formatMoney = (value: string) => {
		const num = Number.parseFloat(value);
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			minimumFractionDigits: 0,
		}).format(num);
	};

	const showLoading = isLoading || isFetching || isPending;

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

				<div className="ml-auto">
					<Button asChild>
						<Link href={`/app/${organizationSlug}/bookings/new`}>
							<PlusIcon className="mr-2 h-4 w-4" />
							New Booking
						</Link>
					</Button>
				</div>
			</div>

			{/* Table */}
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-24">Ref #</TableHead>
							<TableHead>Name</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Package</TableHead>
							<TableHead className="text-right">Value</TableHead>
							<TableHead className="text-right">Balance</TableHead>
							<TableHead className="w-20">Shoots</TableHead>
							<TableHead className="w-12" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							// Loading skeleton
							Array.from({ length: 5 }).map((_, i) => (
								<TableRow key={i}>
									<TableCell><Skeleton className="h-4 w-16" /></TableCell>
									<TableCell>
										<div className="space-y-1">
											<Skeleton className="h-4 w-48" />
											<Skeleton className="h-3 w-32" />
										</div>
									</TableCell>
									<TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
									<TableCell><Skeleton className="h-4 w-24" /></TableCell>
									<TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
									<TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
									<TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
									<TableCell><Skeleton className="h-8 w-8" /></TableCell>
								</TableRow>
							))
						) : bookings.length === 0 ? (
							<TableRow>
								<TableCell colSpan={8} className="h-32 text-center">
									<div className="flex flex-col items-center gap-2">
										<p className="text-muted-foreground">No bookings found</p>
										<Button variant="outline" size="sm" asChild>
											<Link href={`/app/${organizationSlug}/bookings/new`}>
												<PlusIcon className="mr-2 h-4 w-4" />
												Create your first booking
											</Link>
										</Button>
									</div>
								</TableCell>
							</TableRow>
						) : (
							bookings.map((booking) => (
								<TableRow key={booking.id} className={showLoading ? "opacity-50" : ""}>
									<TableCell className="font-mono text-sm">
										{booking.referenceNumber}
									</TableCell>
									<TableCell>
										<Link
											href={`/app/${organizationSlug}/bookings/${booking.id}`}
											className="font-medium hover:underline"
										>
											{booking.name}
										</Link>
										<p className="text-sm text-muted-foreground">
											{booking.bookingType}
										</p>
									</TableCell>
									<TableCell>
										<Badge
											variant="secondary"
											className={statusColors[booking.status as BookingPhase]}
										>
											{statusLabels[booking.status as BookingPhase] ?? booking.status}
										</Badge>
									</TableCell>
									<TableCell>{booking.packageType}</TableCell>
									<TableCell className="text-right font-medium">
										{formatMoney(booking.packageCost)}
									</TableCell>
									<TableCell className="text-right">
										<span
											className={
												Number.parseFloat(booking.balance) > 0
													? "text-amber-600 dark:text-amber-400"
													: "text-green-600 dark:text-green-400"
											}
										>
											{formatMoney(booking.balance)}
										</span>
									</TableCell>
									<TableCell className="text-center">
										{booking.shootsCount}
									</TableCell>
									<TableCell>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="icon">
													<MoreHorizontalIcon className="h-4 w-4" />
													<span className="sr-only">Actions</span>
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem asChild>
													<Link href={`/app/${organizationSlug}/bookings/${booking.id}`}>
														<EyeIcon className="mr-2 h-4 w-4" />
														View details
													</Link>
												</DropdownMenuItem>
												<DropdownMenuItem asChild>
													<Link href={`/app/${organizationSlug}/bookings/${booking.id}/edit`}>
														<PencilIcon className="mr-2 h-4 w-4" />
														Edit
													</Link>
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													className="text-destructive"
													onClick={() => {
														setBookingToDelete(booking);
														setDeleteDialogOpen(true);
													}}
												>
													<TrashIcon className="mr-2 h-4 w-4" />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			{pagination.pageCount > 1 && (
				<div className="flex items-center justify-between">
					<p className="text-sm text-muted-foreground">
						Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
						{Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
						{pagination.total} bookings
					</p>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="icon"
							onClick={() => handlePageChange(pagination.page - 1)}
							disabled={pagination.page <= 1 || showLoading}
						>
							{showLoading ? (
								<Loader2Icon className="h-4 w-4 animate-spin" />
							) : (
								<ChevronLeftIcon className="h-4 w-4" />
							)}
						</Button>

						<span className="text-sm">
							Page {pagination.page} of {pagination.pageCount}
						</span>

						<Button
							variant="outline"
							size="icon"
							onClick={() => handlePageChange(pagination.page + 1)}
							disabled={pagination.page >= pagination.pageCount || showLoading}
						>
							{showLoading ? (
								<Loader2Icon className="h-4 w-4 animate-spin" />
							) : (
								<ChevronRightIcon className="h-4 w-4" />
							)}
						</Button>
					</div>
				</div>
			)}

			{/* Delete confirmation dialog */}
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete booking?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{bookingToDelete?.name}" (
							{bookingToDelete?.referenceNumber}). This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (bookingToDelete) {
									deleteMutation.mutate({ id: bookingToDelete.id });
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
