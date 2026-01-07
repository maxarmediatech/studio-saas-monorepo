"use client";

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
import { Input } from "@repo/ui/components/input";
import {
	DataTable,
	DataTableRowActions,
	type RowAction,
} from "@saas/shared/components/data-table";
import { formatMoney } from "@saas/shared/lib";
import { useExpenseParams } from "@saas/studio/hooks/params/use-expense-params";
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
	SearchIcon,
	StoreIcon,
	TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { OpenExpenseCreateSheet } from "./OpenExpenseSheet";

interface ExpensesPageClientProps {
	organizationSlug: string;
	initialFilters: {
		page: number;
		search?: string;
		category?: string;
		billTo?: string;
	};
}

const formatDate = (dateString: string) => {
	return new Date(dateString).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
	cash: "Cash",
	upi: "UPI",
	bank_transfer: "Bank Transfer",
	cheque: "Cheque",
	card: "Card",
	other: "Other",
};

export function ExpensesPageClient({
	organizationSlug,
	initialFilters,
}: ExpensesPageClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isPending, startTransition] = useTransition();

	const [searchValue, setSearchValue] = useState(initialFilters.search ?? "");
	const [currentFilters, setCurrentFilters] = useState(initialFilters);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [expenseToDelete, setExpenseToDelete] =
		useState<ExpenseListItem | null>(null);

	// URL-based sheet params
	const { openEdit } = useExpenseParams();

	// Build query input
	const queryInput = {
		page: currentFilters.page,
		limit: 10,
		search: currentFilters.search,
		category: currentFilters.category,
		billTo: currentFilters.billTo as "studio" | "client" | undefined,
		sortBy: "expenseDate" as const,
		sortDirection: "desc" as const,
		includeDeleted: false,
	};

	// Fetch expenses with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		expensesApi.listOptions(queryInput),
	);

	const expenses = data?.data ?? [];
	const pagination = data?.pagination ?? {
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
		if (newFilters.category) {
			params.set("category", newFilters.category);
		}
		if (newFilters.billTo) {
			params.set("billTo", newFilters.billTo);
		}

		const queryString = params.toString();
		const url = `/app/${organizationSlug}/expenses${queryString ? `?${queryString}` : ""}`;

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

	const handleOpenEdit = (expense: ExpenseListItem) => {
		openEdit(expense.id);
	};

	// Define row actions
	const rowActions: RowAction<ExpenseListItem>[] = [
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
	];

	// Define columns
	const columns: ColumnDef<ExpenseListItem>[] = useMemo(
		() => [
			{
				accessorKey: "description",
				header: "Description",
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
								<p className="text-sm text-muted-foreground flex items-center gap-1">
									<StoreIcon className="h-3 w-3" />
									{row.original.vendor}
								</p>
							)}
						</div>
					</div>
				),
			},
			{
				accessorKey: "amount",
				header: "Amount",
				cell: ({ row }) => (
					<span className="font-semibold text-primary">
						{formatMoney(row.original.amount)}
					</span>
				),
			},
			{
				accessorKey: "category",
				header: "Category",
				cell: ({ row }) =>
					row.original.category ? (
						<Badge variant="secondary">
							{row.original.category}
						</Badge>
					) : (
						<span className="text-muted-foreground">-</span>
					),
			},
			{
				accessorKey: "expenseDate",
				header: "Date",
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<CalendarIcon className="h-4 w-4 text-muted-foreground" />
						<span>{formatDate(row.original.expenseDate)}</span>
					</div>
				),
			},
			{
				accessorKey: "billTo",
				header: "Bill To",
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
			},
			{
				accessorKey: "paymentMethod",
				header: "Payment",
				cell: ({ row }) =>
					row.original.paymentMethod ? (
						<span className="text-sm">
							{PAYMENT_METHOD_LABELS[
								row.original.paymentMethod
							] || row.original.paymentMethod}
						</span>
					) : (
						<span className="text-muted-foreground">-</span>
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
						placeholder="Search expenses..."
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleSearch()}
						className="pl-9"
					/>
				</div>

				<div className="ml-auto">
					<OpenExpenseCreateSheet />
				</div>
			</div>

			{/* Table */}
			<DataTable
				columns={columns}
				data={expenses}
				isLoading={isLoading}
				isFetching={showLoading}
				pagination={pagination}
				onPaginationChange={handlePaginationChange}
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
		</div>
	);
}
