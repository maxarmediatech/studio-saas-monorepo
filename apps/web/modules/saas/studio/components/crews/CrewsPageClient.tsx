"use client";

import type { Crew } from "@repo/api/modules/studio/schemas/crew";
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
import { useCrewParams } from "@saas/studio/hooks/params/use-crew-params";
import {
	crewsApi,
	crewsMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	Loader2Icon,
	PencilIcon,
	SearchIcon,
	TrashIcon,
	UserIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { OpenCrewCreateSheet } from "./OpenCrewSheet";

interface CrewsPageClientProps {
	organizationSlug: string;
	initialFilters: {
		page: number;
		search?: string;
		status?: string;
		role?: string;
	};
}

const statusColors: Record<string, string> = {
	active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	inactive:
		"bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
	unavailable:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const formatMoney = (value: string | null) => {
	if (!value) {
		return "-";
	}
	const num = Number.parseFloat(value);
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
	}).format(num);
};

export function CrewsPageClient({
	organizationSlug,
	initialFilters,
}: CrewsPageClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isPending, startTransition] = useTransition();

	const [searchValue, setSearchValue] = useState(initialFilters.search ?? "");
	const [currentFilters, setCurrentFilters] = useState(initialFilters);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [crewToDelete, setCrewToDelete] = useState<Crew | null>(null);

	// URL-based sheet params
	const { openEdit } = useCrewParams();

	// Build query input
	const queryInput = {
		page: currentFilters.page,
		limit: 10,
		search: currentFilters.search,
		status: currentFilters.status,
		role: currentFilters.role,
		sortBy: "createdAt" as const,
		sortDirection: "desc" as const,
		includeDeleted: false,
	};

	// Fetch crews with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		crewsApi.listOptions(queryInput),
	);

	const crews = data?.data ?? [];
	const pagination = data?.pagination ?? {
		page: 1,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	// Delete mutation
	const deleteMutation = useMutation({
		...crewsMutations.delete(),
		onSuccess: () => {
			toast.success("Crew member deleted successfully");
			setDeleteDialogOpen(false);
			setCrewToDelete(null);
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.crews.all,
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete crew member");
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
		if (newFilters.role) {
			params.set("role", newFilters.role);
		}

		const queryString = params.toString();
		const url = `/app/${organizationSlug}/crews${queryString ? `?${queryString}` : ""}`;

		startTransition(() => {
			router.push(url, { scroll: false });
		});
	};

	const handleSearch = () => {
		updateFilters({ search: searchValue || undefined, page: 1 });
	};

	const handleStatusChange = (value: string) => {
		updateFilters({
			status: value === "all" ? undefined : value,
			page: 1,
		});
	};

	const handlePaginationChange = (newPagination: typeof pagination) => {
		updateFilters({ page: newPagination.page });
	};

	const handleOpenEdit = (crew: Crew) => {
		openEdit(crew.id);
	};

	// Define row actions
	const rowActions: RowAction<Crew>[] = [
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
				setCrewToDelete(row);
				setDeleteDialogOpen(true);
			},
		},
	];

	// Define columns
	const columns: ColumnDef<Crew>[] = useMemo(
		() => [
			{
				accessorKey: "name",
				header: "Name",
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
							<UserIcon className="h-4 w-4 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium">{row.original.name}</p>
							{row.original.email && (
								<p className="text-sm text-muted-foreground">
									{row.original.email}
								</p>
							)}
						</div>
					</div>
				),
			},
			{
				accessorKey: "role",
				header: "Role",
				cell: ({ row }) => (
					<span className="capitalize">
						{row.original.role.replace(/_/g, " ")}
					</span>
				),
			},
			{
				accessorKey: "phoneNumber",
				header: "Phone",
				cell: ({ row }) => row.original.phoneNumber || "-",
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => (
					<Badge
						variant="secondary"
						className={
							statusColors[row.original.status] ??
							statusColors.active
						}
					>
						{row.original.status}
					</Badge>
				),
			},
			{
				accessorKey: "dailyRate",
				header: () => <div className="text-right">Daily Rate</div>,
				cell: ({ row }) => (
					<div className="text-right">
						{formatMoney(row.original.dailyRate)}
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
						placeholder="Search crew members..."
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
						<SelectItem value="active">Active</SelectItem>
						<SelectItem value="inactive">Inactive</SelectItem>
						<SelectItem value="unavailable">Unavailable</SelectItem>
					</SelectContent>
				</Select>

				<div className="ml-auto">
					<OpenCrewCreateSheet />
				</div>
			</div>

			{/* Table */}
			<DataTable
				columns={columns}
				data={crews}
				isLoading={isLoading}
				isFetching={showLoading}
				pagination={pagination}
				onPaginationChange={handlePaginationChange}
				emptyState={
					<div className="flex flex-col items-center gap-2">
						<UserIcon className="h-12 w-12 text-muted-foreground/50" />
						<p className="text-muted-foreground">
							No crew members found
						</p>
						<OpenCrewCreateSheet
							variant="outline"
							size="sm"
							label="Add your first crew member"
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
						<AlertDialogTitle>Delete crew member?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{crewToDelete?.name}".
							This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (crewToDelete) {
									deleteMutation.mutate({
										id: crewToDelete.id,
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
