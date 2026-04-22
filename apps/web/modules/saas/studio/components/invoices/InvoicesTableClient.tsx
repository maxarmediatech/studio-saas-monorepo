"use client";

import type { InvoiceListItem } from "@repo/api/modules/studio/schemas/invoice";
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
import "@saas/shared/components/data-table/types";
import { formatMoney } from "@saas/shared/lib";
import { useInvoicesTable } from "@saas/studio/hooks/tables/use-invoices-table";
import { invoicesApi, invoicesMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CalendarIcon,
	CircleIcon,
	EyeIcon,
	FileTextIcon,
	Loader2Icon,
	PencilIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface InvoicesTableClientProps {
	organizationSlug: string;
}

const STATUS_COLORS: Record<string, string> = {
	draft: "fill-gray-400 text-gray-400",
	sent: "fill-blue-400 text-blue-400",
	paid: "fill-green-400 text-green-400",
	partial: "fill-yellow-400 text-yellow-400",
	overdue: "fill-red-400 text-red-400",
	cancelled: "fill-gray-400 text-gray-400",
};

export function InvoicesTableClient({
	organizationSlug,
}: InvoicesTableClientProps) {
	const queryClient = useQueryClient();
	const router = useRouter();

	const {
		filters,
		pagination,
		sorting,
		sortingState,
		columnVisibility,
		onColumnVisibilityChange,
		onSortingChange,
		onPaginationChange,
		onLimitChange,
	} = useInvoicesTable();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [invoiceToDelete, setInvoiceToDelete] =
		useState<InvoiceListItem | null>(null);

	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		status: filters.statuses ?? undefined,
		bookingId: filters.bookingId ?? undefined,
		clientId: filters.clientId ?? undefined,
		dateFrom: filters.createdAt?.[0] ?? undefined,
		dateTo: filters.createdAt?.[1] ?? undefined,
		sortBy: sorting.sortBy ?? "createdAt",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	const { data, isLoading, isFetching } = useQuery(
		invoicesApi.listOptions(queryInput),
	);

	const invoices = data?.data ?? [];
	const serverPagination = data?.pagination ?? {
		page: 1,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	const deleteMutation = useMutation({
		...invoicesMutations.delete(),
		onSuccess: () => {
			toast.success("Invoice deleted successfully");
			setDeleteDialogOpen(false);
			setInvoiceToDelete(null);
			queryClient.invalidateQueries({
				queryKey: orpc.invoices.key(),
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete invoice");
		},
	});

	const rowActions: RowAction<InvoiceListItem>[] = useMemo(
		() => [
			{
				label: "View details",
				icon: <EyeIcon className="h-4 w-4" />,
				onClick: (row) => {
					router.push(`/app/${organizationSlug}/invoices/${row.id}`);
				},
			},
			{
				label: "Edit",
				icon: <PencilIcon className="h-4 w-4" />,
				onClick: (row) => {
					router.push(`/app/${organizationSlug}/invoices/${row.id}`);
				},
				show: (row) => row.status === "draft",
			},
			{
				label: "Delete",
				icon: <TrashIcon className="h-4 w-4" />,
				variant: "destructive",
				separator: true,
				onClick: (row) => {
					setInvoiceToDelete(row);
					setDeleteDialogOpen(true);
				},
			},
		],
		[organizationSlug, router],
	);

	const columns: ColumnDef<InvoiceListItem>[] = useMemo(
		() => [
			createSelectColumn<InvoiceListItem>(),
			{
				id: "invoiceNumber",
				accessorKey: "invoiceNumber",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Number" />
				),
				cell: ({ row }) => (
					<Link
						href={`/app/${organizationSlug}/invoices/${row.original.id}`}
						className="font-medium text-foreground hover:underline font-mono"
					>
						{row.original.invoiceNumber}
					</Link>
				),
				meta: {
					label: "Number",
					width: 140,
					minWidth: 140,
					icon: FileTextIcon,
				},
				enableSorting: true,
				enableHiding: false,
			},
			{
				id: "booking",
				accessorKey: "bookingName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Booking" />
				),
				cell: ({ row }) => (
					<Link
						href={`/app/${organizationSlug}/bookings/${row.original.bookingId}`}
						className="text-muted-foreground hover:underline"
					>
						{row.original.bookingName}
					</Link>
				),
				meta: {
					label: "Booking",
					width: 200,
					minWidth: 160,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "totalAmount",
				accessorKey: "totalAmount",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Amount"
						className="justify-end"
					/>
				),
				cell: ({ row }) => (
					<span className="tabular-nums text-right block font-medium">
						{formatMoney(row.original.totalAmount)}
					</span>
				),
				meta: {
					label: "Amount",
					width: 120,
					minWidth: 120,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "status",
				accessorKey: "status",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Status" />
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<CircleIcon
							className={`h-2 w-2 ${
								STATUS_COLORS[row.original.status] ??
								"fill-gray-400 text-gray-400"
							}`}
						/>
						<span className="capitalize">
							{row.original.status}
						</span>
					</div>
				),
				meta: {
					label: "Status",
					width: 120,
					minWidth: 120,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "issueDate",
				accessorKey: "issueDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Date" />
				),
				cell: ({ row }) => {
					const date = new Date(row.original.issueDate);
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
					label: "Date",
					icon: CalendarIcon,
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
					width: 48,
					minWidth: 48,
				},
			},
		],
		[organizationSlug, rowActions],
	);

	return (
		<>
			<SortProvider
				sortColumn={sorting.sortBy}
				sortDirection={sorting.sortDirection}
			>
				<DataTable
					columns={columns}
					data={invoices}
					isLoading={isLoading}
					isFetching={isFetching}
					pagination={serverPagination}
					onPaginationChange={onPaginationChange}
					onLimitChange={onLimitChange}
					sorting={sortingState}
					onSortingChange={onSortingChange}
					columnVisibility={columnVisibility}
					onColumnVisibilityChange={onColumnVisibilityChange}
					enableRowSelection
					getRowId={(row) => row.id}
					emptyState={
						<div className="flex flex-col items-center gap-2">
							<p className="text-muted-foreground">
								No invoices found
								</p>
								<Button variant="outline" size="sm" asChild>
									<Link
										href={`/app/${organizationSlug}/bookings`}
									>
										<PlusIcon className="mr-2 h-4 w-4" />
										Go to bookings
									</Link>
								</Button>
							</div>
						}
				/>
			</SortProvider>

			<AlertDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete invoice?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete invoice "
							{invoiceToDelete?.invoiceNumber}". This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (invoiceToDelete) {
									deleteMutation.mutate({
										id: invoiceToDelete.id,
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
