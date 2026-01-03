"use client";

import type { PaymentMethod } from "@repo/api/modules/studio/schemas/common";
import type { ReceivedAmountListItem } from "@repo/api/modules/studio/schemas/payment";
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
import {
	createSelectColumn,
	DataTable,
	DataTableColumnHeader,
	DataTableRowActions,
	DataTableToolbar,
	DataTableViewOptions,
	type RowAction,
	SortProvider,
} from "@saas/shared/components/data-table";
// Import types for column meta augmentation
import "@saas/shared/components/data-table/types";
import { usePaymentParams } from "@saas/studio/hooks/params/use-payment-params";
import { usePaymentsTable } from "@saas/studio/hooks/tables";
import {
	studioPaymentsApi,
	studioPaymentsMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	BanknoteIcon,
	CalendarIcon,
	CreditCardIcon,
	HashIcon,
	Loader2Icon,
	PencilIcon,
	TrashIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OpenPaymentCreateSheet } from "./OpenPaymentSheet";

// Note: organizationSlug kept for future payment detail page navigation
interface PaymentsTableClientProps {
	organizationSlug?: string;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
	cash: "Cash",
	upi: "UPI",
	bank_transfer: "Bank Transfer",
	cheque: "Cheque",
	card: "Card",
	other: "Other",
};

const PAYMENT_METHOD_VARIANTS: Record<
	string,
	"default" | "secondary" | "outline"
> = {
	cash: "default",
	upi: "secondary",
	bank_transfer: "outline",
	cheque: "outline",
	card: "secondary",
	other: "outline",
};

const paymentMethodOptions = [
	{ value: "cash", label: "Cash" },
	{ value: "upi", label: "UPI" },
	{ value: "bank_transfer", label: "Bank Transfer" },
	{ value: "cheque", label: "Cheque" },
	{ value: "card", label: "Card" },
	{ value: "other", label: "Other" },
];

const formatMoney = (value: string) => {
	const num = Number.parseFloat(value);
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
	}).format(num);
};

const formatDate = (dateStr: string) => {
	return new Date(dateStr).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
};

export function PaymentsTableClient({
	organizationSlug: _organizationSlug,
}: PaymentsTableClientProps) {
	const queryClient = useQueryClient();

	// Use the payments table hook for URL-synced state
	const {
		filters,
		pagination,
		sorting,
		sortingState,
		setFilter,
		resetFilters,
		isFiltered,
		onSortingChange,
		onPaginationChange,
	} = usePaymentsTable();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [paymentToDelete, setPaymentToDelete] =
		useState<ReceivedAmountListItem | null>(null);

	// URL-based sheet params
	const { openEdit } = usePaymentParams();

	// Build query input from hook state
	// Note: API expects single paymentMethod, so take the first value if provided
	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		paymentMethod: filters.paymentMethod?.[0] as PaymentMethod | undefined,
		sortBy: sorting.sortBy ?? "receivedDate",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	// Fetch payments with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		studioPaymentsApi.listReceivedOptions(queryInput),
	);

	const payments = data?.data ?? [];
	const serverPagination = data?.pagination ?? {
		page: 1,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	// Delete mutation
	const deleteMutation = useMutation({
		...studioPaymentsMutations.deleteReceived(),
		onSuccess: () => {
			toast.success("Payment deleted successfully");
			setDeleteDialogOpen(false);
			setPaymentToDelete(null);
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.payments.all,
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete payment");
		},
	});

	const handleOpenEdit = (payment: ReceivedAmountListItem) => {
		openEdit(payment.id);
	};

	// Define row actions
	const rowActions: RowAction<ReceivedAmountListItem>[] = useMemo(
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
					setPaymentToDelete(row);
					setDeleteDialogOpen(true);
				},
			},
		],
		[],
	);

	// Define columns with sortable headers and meta for filters
	const columns: ColumnDef<ReceivedAmountListItem>[] = useMemo(
		() => [
			createSelectColumn<ReceivedAmountListItem>(),
			{
				id: "booking",
				accessorKey: "bookingName",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Booking" />
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
							<BanknoteIcon className="h-4 w-4 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium">
								{row.original.bookingName}
							</p>
							<p className="text-xs text-muted-foreground">
								{row.original.bookingReferenceNumber}
							</p>
						</div>
					</div>
				),
				meta: {
					label: "Booking",
					width: 240,
					minWidth: 240,
					// Last left-sticky column - add right border
					headerClassName:
						"!border-r-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border",
					cellClassName:
						"!border-r-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-border",
				},
				enableSorting: false,
				enableHiding: false,
			},
			{
				id: "amount",
				accessorKey: "amount",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Amount" />
				),
				cell: ({ row }) => (
					<span className="font-semibold text-green-600 dark:text-green-400">
						{formatMoney(row.original.amount)}
					</span>
				),
				meta: {
					label: "Amount",
					width: 130,
					minWidth: 130,
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
					<Badge
						variant={
							PAYMENT_METHOD_VARIANTS[row.original.paymentMethod]
						}
					>
						{PAYMENT_METHOD_LABELS[row.original.paymentMethod]}
					</Badge>
				),
				meta: {
					label: "Method",
					variant: "multiSelect" as const,
					icon: CreditCardIcon,
					options: paymentMethodOptions,
					width: 140,
					minWidth: 140,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "receivedDate",
				accessorKey: "receivedDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Date" />
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<CalendarIcon className="h-4 w-4 text-muted-foreground" />
						<span>{formatDate(row.original.receivedDate)}</span>
					</div>
				),
				meta: {
					label: "Date",
					icon: CalendarIcon,
					width: 130,
					minWidth: 130,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "transactionReference",
				accessorKey: "transactionReference",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Reference" />
				),
				cell: ({ row }) =>
					row.original.transactionReference ? (
						<div className="flex items-center gap-2">
							<HashIcon className="h-3 w-3 text-muted-foreground" />
							<span className="text-sm font-mono">
								{row.original.transactionReference}
							</span>
						</div>
					) : (
						<span className="text-muted-foreground">-</span>
					),
				meta: {
					label: "Reference",
					icon: HashIcon,
					width: 150,
					minWidth: 150,
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
					width: 56,
					minWidth: 56,
					// First right-sticky column - add left border + fade
					headerClassName:
						"!px-0 md:sticky md:right-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-background",
					cellClassName:
						"!px-0 md:sticky md:right-0 bg-background z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-background",
				},
			},
		],
		[rowActions],
	);

	return (
		<>
			<div className="space-y-4">
				{/* Toolbar with filters */}
				<div className="flex items-center justify-between gap-4">
					<DataTableToolbar
						filters={[
							{
								id: "paymentMethod",
								label: "Method",
								variant: "multiSelect",
								options: paymentMethodOptions,
								icon: CreditCardIcon,
							},
						]}
						filterValues={{
							paymentMethod: filters.paymentMethod ?? [],
						}}
						onFilterChange={(id, value) => {
							if (id === "paymentMethod") {
								setFilter("paymentMethod", value as string[]);
							}
						}}
						onResetFilters={resetFilters}
						isFiltered={isFiltered}
						showSearch
						searchValue={filters.search ?? ""}
						searchPlaceholder="Search payments..."
						onSearchChange={(value) =>
							setFilter("search", value || null)
						}
						className="flex-1"
					/>
					<OpenPaymentCreateSheet />
				</div>

				{/* Table with sort context */}
				<SortProvider
					sortColumn={sorting.sortBy}
					sortDirection={sorting.sortDirection}
				>
					<DataTable
						columns={columns}
						data={payments}
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
							{ id: "select", width: 56 },
							{ id: "booking", width: 240 },
						]}
						stickyRightColumns={[{ id: "actions", width: 56 }]}
						minWidth={950}
						// Place scroll controls in the last sticky left column
						scrollControlsColumnId="booking"
						scrollStartColumn={2}
						emptyState={
							<div className="flex flex-col items-center gap-2">
								<BanknoteIcon className="h-12 w-12 text-muted-foreground/50" />
								<p className="text-muted-foreground">
									No payments recorded
								</p>
								<OpenPaymentCreateSheet
									variant="outline"
									size="sm"
									label="Record your first payment"
								/>
							</div>
						}
					/>
				</SortProvider>
			</div>

			{/* Delete confirmation dialog */}
			<AlertDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete payment?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the payment of{" "}
							{paymentToDelete &&
								formatMoney(paymentToDelete.amount)}{" "}
							for "{paymentToDelete?.bookingName}". This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (paymentToDelete) {
									deleteMutation.mutate({
										id: paymentToDelete.id,
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
