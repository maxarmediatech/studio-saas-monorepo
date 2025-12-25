"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
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
import {
	PencilIcon,
	TrashIcon,
	PlusIcon,
	SearchIcon,
	Loader2Icon,
	UserIcon,
	MailIcon,
	PhoneIcon,
} from "lucide-react";
import { toast } from "sonner";
import { clientsApi, clientsMutations, studioQueryKeys } from "@saas/studio/lib/api";
import {
	DataTable,
	DataTableRowActions,
	type RowAction,
} from "@saas/shared/components/data-table";
import type { Client } from "@repo/api/modules/studio/schemas/client";
import { ClientFormDialog } from "./ClientFormDialog";

interface ClientsPageClientProps {
	organizationSlug: string;
	initialFilters: {
		page: number;
		search?: string;
	};
}

export function ClientsPageClient({
	organizationSlug,
	initialFilters,
}: ClientsPageClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isPending, startTransition] = useTransition();

	const [searchValue, setSearchValue] = useState(initialFilters.search ?? "");
	const [currentFilters, setCurrentFilters] = useState(initialFilters);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
	const [formDialogOpen, setFormDialogOpen] = useState(false);
	const [editingClient, setEditingClient] = useState<Client | null>(null);

	// Build query input
	const queryInput = {
		page: currentFilters.page,
		limit: 10,
		search: currentFilters.search,
		sortBy: "createdAt" as const,
		sortDirection: "desc" as const,
		includeDeleted: false,
	};

	// Fetch clients with TanStack Query
	const { data, isLoading, isFetching } = useQuery(clientsApi.listOptions(queryInput));

	const clients = data?.data ?? [];
	const pagination = data?.pagination ?? { page: 1, limit: 10, total: 0, pageCount: 0 };

	// Delete mutation
	const deleteMutation = useMutation({
		...clientsMutations.delete(),
		onSuccess: () => {
			toast.success("Client deleted successfully");
			setDeleteDialogOpen(false);
			setClientToDelete(null);
			queryClient.invalidateQueries({ queryKey: studioQueryKeys.clients.all });
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete client");
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
		const url = `/app/${organizationSlug}/clients${queryString ? `?${queryString}` : ""}`;

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

	const handleOpenCreate = () => {
		setEditingClient(null);
		setFormDialogOpen(true);
	};

	const handleOpenEdit = (client: Client) => {
		setEditingClient(client);
		setFormDialogOpen(true);
	};

	const handleFormSuccess = () => {
		setFormDialogOpen(false);
		setEditingClient(null);
		queryClient.invalidateQueries({ queryKey: studioQueryKeys.clients.all });
	};

	// Define row actions
	const rowActions: RowAction<Client>[] = [
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
				setClientToDelete(row);
				setDeleteDialogOpen(true);
			},
		},
	];

	// Define columns
	const columns: ColumnDef<Client>[] = useMemo(
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
						</div>
					</div>
				),
			},
			{
				accessorKey: "email",
				header: "Email",
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						{row.original.email ? (
							<>
								<MailIcon className="h-4 w-4 text-muted-foreground" />
								<span>{row.original.email}</span>
							</>
						) : (
							<span className="text-muted-foreground">-</span>
						)}
					</div>
				),
			},
			{
				accessorKey: "phoneNumber",
				header: "Phone",
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						{row.original.phoneNumber ? (
							<>
								<PhoneIcon className="h-4 w-4 text-muted-foreground" />
								<span>{row.original.phoneNumber}</span>
							</>
						) : (
							<span className="text-muted-foreground">-</span>
						)}
					</div>
				),
			},
			{
				accessorKey: "address",
				header: "Address",
				cell: ({ row }) => (
					<span className="text-muted-foreground truncate max-w-[200px] block">
						{row.original.address || "-"}
					</span>
				),
			},
			{
				id: "actions",
				cell: ({ row }) => (
					<DataTableRowActions row={row.original} actions={rowActions} />
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
						placeholder="Search clients..."
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleSearch()}
						className="pl-9"
					/>
				</div>

				<div className="ml-auto">
					<Button onClick={handleOpenCreate}>
						<PlusIcon className="mr-2 h-4 w-4" />
						Add Client
					</Button>
				</div>
			</div>

			{/* Table */}
			<DataTable
				columns={columns}
				data={clients}
				isLoading={isLoading}
				isFetching={showLoading}
				pagination={pagination}
				onPaginationChange={handlePaginationChange}
				emptyState={
					<div className="flex flex-col items-center gap-2">
						<UserIcon className="h-12 w-12 text-muted-foreground/50" />
						<p className="text-muted-foreground">No clients found</p>
						<Button variant="outline" size="sm" onClick={handleOpenCreate}>
							<PlusIcon className="mr-2 h-4 w-4" />
							Add your first client
						</Button>
					</div>
				}
			/>

			{/* Create/Edit dialog */}
			<ClientFormDialog
				open={formDialogOpen}
				onOpenChange={setFormDialogOpen}
				client={editingClient}
				onSuccess={handleFormSuccess}
			/>

			{/* Delete confirmation dialog */}
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete client?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{clientToDelete?.name}". This action cannot
							be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (clientToDelete) {
									deleteMutation.mutate({ id: clientToDelete.id });
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
