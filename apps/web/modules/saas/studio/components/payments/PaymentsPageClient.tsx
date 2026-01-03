"use client";

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
import { Input } from "@repo/ui/components/input";
import {
	DataTable,
	DataTableRowActions,
	type RowAction,
} from "@saas/shared/components/data-table";
import { usePaymentParams } from "@saas/studio/hooks/params/use-payment-params";
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
	HashIcon,
	Loader2Icon,
	PencilIcon,
	SearchIcon,
	TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { OpenPaymentCreateSheet } from "./OpenPaymentSheet";

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

interface PaymentsPageClientProps {
	organizationSlug: string;
	initialFilters: {
		page: number;
		search?: string;
	};
}

export function PaymentsPageClient({
	organizationSlug,
	initialFilters,
}: PaymentsPageClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isPending, startTransition] = useTransition();

	const [searchValue, setSearchValue] = useState(initialFilters.search ?? "");
	const [currentFilters, setCurrentFilters] = useState(initialFilters);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [paymentToDelete, setPaymentToDelete] =
		useState<ReceivedAmountListItem | null>(null);

	// URL-based sheet params
	const { openEdit } = usePaymentParams();

	// Build query input
	const queryInput = {
		page: currentFilters.page,
		limit: 10,
		search: currentFilters.search,
		sortBy: "receivedDate" as const,
		sortDirection: "desc" as const,
		includeDeleted: false,
	};

	// Fetch payments with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		studioPaymentsApi.listReceivedOptions(queryInput),
	);

	const payments = data?.data ?? [];
	const pagination = data?.pagination ?? {
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
		const url = `/app/${organizationSlug}/payments${queryString ? `?${queryString}` : ""}`;

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

	const handleOpenEdit = (payment: ReceivedAmountListItem) => {
		openEdit(payment.id);
	};

	// Define row actions
	const rowActions: RowAction<ReceivedAmountListItem>[] = [
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
	];

	// Define columns
	const columns: ColumnDef<ReceivedAmountListItem>[] = useMemo(
		() => [
			{
				accessorKey: "bookingName",
				header: "Booking",
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
			},
			{
				accessorKey: "amount",
				header: "Amount",
				cell: ({ row }) => (
					<span className="font-semibold text-green-600 dark:text-green-400">
						{formatMoney(row.original.amount)}
					</span>
				),
			},
			{
				accessorKey: "paymentMethod",
				header: "Method",
				cell: ({ row }) => (
					<Badge
						variant={
							PAYMENT_METHOD_VARIANTS[row.original.paymentMethod]
						}
					>
						{PAYMENT_METHOD_LABELS[row.original.paymentMethod]}
					</Badge>
				),
			},
			{
				accessorKey: "receivedDate",
				header: "Date",
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<CalendarIcon className="h-4 w-4 text-muted-foreground" />
						<span>{formatDate(row.original.receivedDate)}</span>
					</div>
				),
			},
			{
				accessorKey: "transactionReference",
				header: "Reference",
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
						placeholder="Search payments..."
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleSearch()}
						className="pl-9"
					/>
				</div>

				<div className="ml-auto">
					<OpenPaymentCreateSheet />
				</div>
			</div>

			{/* Table */}
			<DataTable
				columns={columns}
				data={payments}
				isLoading={isLoading}
				isFetching={showLoading}
				pagination={pagination}
				onPaginationChange={handlePaginationChange}
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
		</div>
	);
}
