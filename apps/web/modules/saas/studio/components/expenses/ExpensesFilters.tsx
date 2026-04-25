"use client";

import {
	DataTableExportButton,
	DataTableToolbarWithViews,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import type { SavedView } from "@saas/shared/components/views";
import {
	getBookingFilterValue,
	parseBookingFilterValue,
	useBookingFilterConfig,
} from "@saas/studio/components/shared/booking-filter";
import { useExpensesTableWithViews } from "@saas/studio/hooks/tables";
import { CreditCardIcon, UserIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

const paymentMethodOptions = [
	{ value: "cash", label: "Cash" },
	{ value: "upi", label: "UPI" },
	{ value: "bank_transfer", label: "Bank Transfer" },
	{ value: "cheque", label: "Cheque" },
	{ value: "card", label: "Card" },
	{ value: "other", label: "Other" },
];

const billToOptions = [
	{ value: "studio", label: "Studio" },
	{ value: "client", label: "Client" },
];

export function ExpensesFilters() {
	const {
		filters,
		setFilter,
		resetFilters,
		isFiltered,
		activeViewId,
		applyView,
		pagination,
		sorting,
		sortingState,
		columnVisibility,
	} = useExpensesTableWithViews();
	const bookingFilterConfig = useBookingFilterConfig();

	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
			{
				id: "billTo",
				label: "Bill To",
				variant: "multiSelect",
				icon: UserIcon,
				options: billToOptions,
			},
			{
				id: "paymentMethod",
				label: "Payment",
				variant: "multiSelect",
				icon: CreditCardIcon,
				options: paymentMethodOptions,
			},
			bookingFilterConfig,
		],
		[bookingFilterConfig],
	);

	const filterValues = useMemo(
		() => ({
			bookingId: getBookingFilterValue(filters.bookingId),
			billTo: filters.billTo ?? [],
			paymentMethod: filters.paymentMethod ?? [],
		}),
		[filters.bookingId, filters.billTo, filters.paymentMethod],
	);

	const handleFilterChange = useCallback(
		(
			filterId: string,
			value:
				| string
				| string[]
				| { from?: string; to?: string }
				| null
				| undefined,
		) => {
			if (filterId === "bookingId") {
				setFilter("bookingId", parseBookingFilterValue(value));
			} else if (filterId === "billTo") {
				const values =
					Array.isArray(value) && value.length > 0 ? value : null;
				setFilter("billTo", values);
			} else if (filterId === "paymentMethod") {
				const values =
					Array.isArray(value) && value.length > 0 ? value : null;
				setFilter("paymentMethod", values);
			}
		},
		[setFilter],
	);

	const handleSearchChange = useCallback(
		(value: string) => {
			setFilter("search", value || null);
		},
		[setFilter],
	);

	const handleViewSelect = useCallback(
		(view: SavedView) => {
			applyView(view);
		},
		[applyView],
	);

	const getCurrentFilters = useCallback(() => {
		return filters as Record<string, unknown>;
	}, [filters]);

	const getCurrentSorting = useCallback(() => {
		return sortingState;
	}, [sortingState]);

	const getCurrentColumnVisibility = useCallback(() => {
		return columnVisibility;
	}, [columnVisibility]);

	const queryInput = {
		page: pagination.page,
		limit: pagination.limit,
		search: filters.search ?? undefined,
		category: filters.category ?? undefined,
		billTo: filters.billTo ?? undefined,
		paymentMethod: filters.paymentMethod ?? undefined,
		bookingId: filters.bookingId ?? undefined,
		sortBy: sorting.sortBy ?? "expenseDate",
		sortDirection: sorting.sortDirection,
		includeDeleted: false,
	};

	return (
		<DataTableToolbarWithViews
			entityType="expense"
			activeViewId={activeViewId}
			onViewSelect={handleViewSelect}
			getCurrentFilters={getCurrentFilters}
			getCurrentSorting={getCurrentSorting}
			getCurrentColumnVisibility={getCurrentColumnVisibility}
			filters={filterConfigs}
			filterValues={filterValues}
			onFilterChange={handleFilterChange}
			onResetFilters={resetFilters}
			isFiltered={isFiltered}
			showSearch
			searchValue={filters.search ?? ""}
			searchPlaceholder="Search expenses..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		>
			<DataTableExportButton
				entityType="expense"
				input={queryInput}
				columnVisibility={columnVisibility}
				iconOnly
			/>
		</DataTableToolbarWithViews>
	);
}
