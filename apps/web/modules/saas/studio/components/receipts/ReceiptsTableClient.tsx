"use client";

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
import { useReceiptsTable } from "@saas/studio/hooks/tables/use-receipts-table";
import { receiptsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CalendarIcon,
	DownloadIcon,
	EyeIcon,
	FileTextIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

interface ReceiptsTableClientProps {
	organizationSlug: string;
}

interface ReceiptListItem {
	id: string;
	receiptNumber: string;
	amount: string;
	paymentMethod: string | null;
	receiptDate: string;
	bookingId: string;
	bookingName?: string;
	invoiceId: string | null;
	invoiceNumber?: string | null;
}

export function ReceiptsTableClient({
	organizationSlug,
}: ReceiptsTableClientProps) {
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
	} = useReceiptsTable();

	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		bookingId: filters.bookingId ?? undefined,
		invoiceId: filters.invoiceId ?? undefined,
		paymentScheduleId: filters.paymentScheduleId ?? undefined,
		dateFrom: filters.createdAt?.[0] ?? undefined,
		dateTo: filters.createdAt?.[1] ?? undefined,
		sortBy: sorting.sortBy ?? "receiptDate",
		sortDirection: sorting.sortDirection,
	};

	const { data, isLoading, isFetching } = useQuery(
		receiptsApi.listOptions(queryInput),
	);

	const receipts = (data?.data ?? []) as ReceiptListItem[];
	const serverPagination = data?.pagination ?? {
		page: 1,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	const rowActions: RowAction<ReceiptListItem>[] = useMemo(
		() => [
			{
				label: "View details",
				icon: <EyeIcon className="h-4 w-4" />,
				onClick: (row) => {
					window.location.href = `/app/${organizationSlug}/receipts/${row.id}`;
				},
			},
			{
				label: "Download PDF",
				icon: <DownloadIcon className="h-4 w-4" />,
				onClick: (row) => {
					window.open(`/api/receipts/${row.id}/pdf`, "_blank");
				},
			},
		],
		[organizationSlug],
	);

	const columns: ColumnDef<ReceiptListItem>[] = useMemo(
		() => [
			createSelectColumn<ReceiptListItem>(),
			{
				id: "receiptNumber",
				accessorKey: "receiptNumber",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Number" />
				),
				cell: ({ row }) => (
					<Link
						href={`/app/${organizationSlug}/receipts/${row.original.id}`}
						className="font-medium text-foreground hover:underline font-mono"
					>
						{row.original.receiptNumber}
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
						{row.original.bookingName ?? "—"}
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
				id: "invoice",
				accessorKey: "invoiceNumber",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Invoice" />
				),
				cell: ({ row }) =>
					row.original.invoiceId ? (
						<Link
							href={`/app/${organizationSlug}/invoices/${row.original.invoiceId}`}
							className="text-muted-foreground hover:underline font-mono"
						>
							{row.original.invoiceNumber ?? "—"}
						</Link>
					) : (
						<span className="text-muted-foreground">—</span>
					),
				meta: {
					label: "Invoice",
					width: 140,
					minWidth: 120,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "amount",
				accessorKey: "amount",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Amount"
						className="justify-end"
					/>
				),
				cell: ({ row }) => (
					<span className="tabular-nums text-right block font-medium">
						{formatMoney(row.original.amount)}
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
				id: "paymentMethod",
				accessorKey: "paymentMethod",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Method" />
				),
				cell: ({ row }) => (
					<span className="capitalize">
						{row.original.paymentMethod ?? "—"}
					</span>
				),
				meta: {
					label: "Method",
					width: 100,
					minWidth: 100,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "receiptDate",
				accessorKey: "receiptDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Date" />
				),
				cell: ({ row }) => {
					const date = new Date(row.original.receiptDate);
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
		<SortProvider
			sortColumn={sorting.sortBy}
			sortDirection={sorting.sortDirection}
		>
			<DataTable
				columns={columns}
				data={receipts}
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
							No receipts found
						</p>
						<p className="text-sm text-muted-foreground">
							Receipts are automatically generated when payments
							are linked to invoices.
						</p>
					</div>
				}
			/>
		</SortProvider>
	);
}
