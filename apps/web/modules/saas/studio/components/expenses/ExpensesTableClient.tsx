"use client";

import type {
	BillTo,
	PaymentMethod,
} from "@repo/api/modules/studio/schemas/common";
import type { ExpenseListItem } from "@repo/api/modules/studio/schemas/expense";
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
	DataTableViewOptions,
	type RowAction,
	SortProvider,
} from "@saas/shared/components/data-table";
// Import types for column meta augmentation
import "@saas/shared/components/data-table/types";
import { formatMoney } from "@saas/shared/lib";
import { useExpenseParams } from "@saas/studio/hooks/params/use-expense-params";
import { useExpensesTable } from "@saas/studio/hooks/tables";
import {
	expensesApi,
	expensesMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CalendarIcon,
	Loader2Icon,
	PencilIcon,
	ReceiptIcon,
	StoreIcon,
	TagIcon,
	TrashIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OpenExpenseCreateSheet } from "./OpenExpenseSheet";

// Note: organizationSlug kept for future expense detail page navigation
interface ExpensesTableClientProps {
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

const formatDate = (dateStr: string) => {
	return new Date(dateStr).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
};

export function ExpensesTableClient({
	organizationSlug: _organizationSlug,
}: ExpensesTableClientProps) {
	const queryClient = useQueryClient();

	// Use the expenses table hook for URL-synced state
	const {
		filters,
		pagination,
		sorting,
		sortingState,
		onSortingChange,
		onPaginationChange,
		onLimitChange,
	} = useExpensesTable();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [expenseToDelete, setExpenseToDelete] =
		useState<ExpenseListItem | null>(null);

	// URL-based sheet params
	const { openEdit } = useExpenseParams();

	// Build query input from hook state
	// Note: API expects single values for category, billTo, paymentMethod
	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		category: filters.category ?? undefined,
		billTo: filters.billTo as BillTo[] | undefined,
		paymentMethod: filters.paymentMethod as PaymentMethod[] | undefined,
		sortBy: sorting.sortBy ?? "expenseDate",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	// Fetch expenses with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		expensesApi.listOptions(queryInput),
	);

	const expenses = data?.data ?? [];
	const serverPagination = data?.pagination ?? {
		page: 1,
		limit: 10,
		total: 0,
		pageCount: 0,
	};

	// Delete mutation
	const deleteMutation = useMutation({
		...expensesMutations.delete(),
		onSuccess: () => {
			toast.success("Expense deleted successfully");
			setDeleteDialogOpen(false);
			setExpenseToDelete(null);
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.expenses.all,
			});
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete expense");
		},
	});

	const handleOpenEdit = (expense: ExpenseListItem) => {
		openEdit(expense.id);
	};

	// Define row actions
	const rowActions: RowAction<ExpenseListItem>[] = useMemo(
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
					setExpenseToDelete(row);
					setDeleteDialogOpen(true);
				},
			},
		],
		[],
	);

	// Define columns with sortable headers and meta for filters
	const columns: ColumnDef<ExpenseListItem>[] = useMemo(
		() => [
			createSelectColumn<ExpenseListItem>(),
			{
				id: "description",
				accessorKey: "description",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Description"
					/>
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
							<ReceiptIcon className="h-4 w-4 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium">
								{row.original.description}
							</p>
							{row.original.vendor && (
								<p className="text-xs text-muted-foreground flex items-center gap-1">
									<StoreIcon className="h-3 w-3" />
									{row.original.vendor}
								</p>
							)}
						</div>
					</div>
				),
				meta: {
					label: "Description",
					width: 260,
					minWidth: 260,
					// Last left-sticky column - add right border
					headerClassName:
						"!border-r-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[0.5px] after:bg-table-border-subtle",
					cellClassName:
						"!border-r-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[0.5px] after:bg-table-border-subtle",
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
					<span className="font-semibold text-primary">
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
				id: "category",
				accessorKey: "category",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Category" />
				),
				cell: ({ row }) =>
					row.original.category ? (
						<Badge variant="secondary">
							{row.original.category}
						</Badge>
					) : (
						<span className="text-muted-foreground">-</span>
					),
				meta: {
					label: "Category",
					icon: TagIcon,
					width: 140,
					minWidth: 140,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "expenseDate",
				accessorKey: "expenseDate",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Date" />
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<CalendarIcon className="h-4 w-4 text-muted-foreground" />
						<span>{formatDate(row.original.expenseDate)}</span>
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
				id: "billTo",
				accessorKey: "billTo",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Bill To" />
				),
				cell: ({ row }) => (
					<Badge
						variant={
							row.original.billTo === "studio"
								? "default"
								: "outline"
						}
					>
						{row.original.billTo === "studio" ? "Studio" : "Client"}
					</Badge>
				),
				meta: {
					label: "Bill To",
					width: 100,
					minWidth: 100,
				},
				enableSorting: true,
				enableHiding: true,
			},
			{
				id: "paymentMethod",
				accessorKey: "paymentMethod",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Payment" />
				),
				cell: ({ row }) =>
					row.original.paymentMethod ? (
						<Badge
							variant={
								PAYMENT_METHOD_VARIANTS[
									row.original.paymentMethod
								]
							}
						>
							{PAYMENT_METHOD_LABELS[row.original.paymentMethod]}
						</Badge>
					) : (
						<span className="text-muted-foreground">-</span>
					),
				meta: {
					label: "Payment",
					width: 140,
					minWidth: 140,
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
						"!px-0 md:sticky md:right-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-gray-100",
					cellClassName:
						"!px-0 md:sticky md:right-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:left-[-24px] after:top-0 after:bottom-0 after:w-6 after:bg-gradient-to-r after:from-transparent after:to-table-surface group-data-[state=selected]:after:to-table-row-selected",
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
					data={expenses}
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
						{ id: "description", width: 260 },
					]}
					stickyRightColumns={[{ id: "actions", width: 56 }]}
					minWidth={1000}
					// Place scroll controls in the last sticky left column
					scrollControlsColumnId="description"
					scrollStartColumn={2}
					emptyState={
						<div className="flex flex-col items-center gap-2">
							<ReceiptIcon className="h-12 w-12 text-muted-foreground/50" />
							<p className="text-muted-foreground">
								No expenses found
							</p>
							<OpenExpenseCreateSheet
								variant="outline"
								size="sm"
								label="Add your first expense"
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
						<AlertDialogTitle>Delete expense?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "
							{expenseToDelete?.description}". This action cannot
							be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (expenseToDelete) {
									deleteMutation.mutate({
										id: expenseToDelete.id,
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
