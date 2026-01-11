"use client";

import type { Client } from "@repo/api/modules/studio/schemas/client";
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
import { useClientParams } from "@saas/studio/hooks/params/use-client-params";
import { useClientsTable } from "@saas/studio/hooks/tables";
import {
	clientsApi,
	clientsMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	Loader2Icon,
	MailIcon,
	PencilIcon,
	PhoneIcon,
	TrashIcon,
	UserIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OpenClientCreateSheet } from "./OpenClientSheet";

export function ClientsTableClient() {
	const queryClient = useQueryClient();

	// Use the clients table hook for URL-synced state
	const {
		filters,
		pagination,
		sorting,
		sortingState,
		onSortingChange,
		onPaginationChange,
		onLimitChange,
	} = useClientsTable();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

	// URL-based sheet params
	const { openEdit } = useClientParams();

	// Build query input from hook state
	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		sortBy: (sorting.sortBy ?? "name") as
			| "name"
			| "email"
			| "createdAt"
			| "updatedAt",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	// Fetch clients with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		clientsApi.listOptions(queryInput),
	);

	const clients = data?.data ?? [];
	const serverPagination = data?.pagination ?? {
		page: 1,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	// Delete mutation
	const deleteMutation = useMutation({
		...clientsMutations.delete(),
		onSuccess: () => {
			toast.success("Client deleted successfully");
			setDeleteDialogOpen(false);
			setClientToDelete(null);
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.clients.all,
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete client");
		},
	});

	const handleOpenEdit = (client: Client) => {
		openEdit(client.id);
	};

	// Define row actions
	const rowActions: RowAction<Client>[] = useMemo(
		() => [
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
		],
		[],
	);

	// Define columns with sortable headers and meta for filters
	const columns: ColumnDef<Client>[] = useMemo(
		() => [
			createSelectColumn<Client>(),
			{
				id: "name",
				accessorKey: "name",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Name" />
				),
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
				meta: {
					label: "Name",
					width: 220,
					minWidth: 220,
					// Last left-sticky column - add right border
					headerClassName:
						"!border-r-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border",
					cellClassName:
						"!border-r-0 bg-table-surface z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border",
				},
				enableSorting: true,
				enableHiding: false,
			},
			{
				id: "email",
				accessorKey: "email",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Email" />
				),
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
				meta: {
					label: "Email",
					width: 220,
					minWidth: 220,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "phoneNumber",
				accessorKey: "phoneNumber",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Phone" />
				),
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
				meta: {
					label: "Phone",
					width: 160,
					minWidth: 160,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "address",
				accessorKey: "address",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Address" />
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground truncate max-w-[200px] block">
						{row.original.address || "-"}
					</span>
				),
				meta: {
					label: "Address",
					width: 200,
					minWidth: 200,
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
							{date.toLocaleDateString("en-IN", {
								day: "numeric",
								month: "short",
								year: "numeric",
							})}
						</span>
					);
				},
				meta: {
					label: "Created",
					width: 120,
					minWidth: 120,
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
					width: 56,
					minWidth: 56,
					// First right-sticky column - add left border + fade
					headerClassName:
						"!px-0 md:sticky md:right-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-gray-100",
					cellClassName:
						"!px-0 md:sticky md:right-0 bg-table-surface z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-table-surface",
				},
			},
		],
		[rowActions],
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
					data={clients}
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
						{ id: "select", width: 56 },
						{ id: "name", width: 220 },
					]}
					stickyRightColumns={[{ id: "actions", width: 56 }]}
					minWidth={1000}
					// Place scroll controls in the last sticky left column
					scrollControlsColumnId="name"
					scrollStartColumn={2}
					emptyState={
						<div className="flex flex-col items-center gap-2">
							<UserIcon className="h-12 w-12 text-muted-foreground/50" />
							<p className="text-muted-foreground">
								No clients found
							</p>
							<OpenClientCreateSheet
								variant="outline"
								size="sm"
								label="Add your first client"
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
						<AlertDialogTitle>Delete client?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{clientToDelete?.name}
							". This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (clientToDelete) {
									deleteMutation.mutate({
										id: clientToDelete.id,
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
