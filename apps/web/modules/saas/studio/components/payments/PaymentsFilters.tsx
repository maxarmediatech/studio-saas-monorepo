"use client";

import type { ToolbarFilterConfig } from "@saas/shared/components/data-table";
import { DataTableToolbarWithViews } from "@saas/shared/components/data-table";
import type { SavedView } from "@saas/shared/components/views";
import { usePaymentsTableWithViews } from "@saas/studio/hooks/tables";
import { CreditCardIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

const PAYMENT_METHOD_OPTIONS = [
	{ value: "cash", label: "Cash" },
	{ value: "upi", label: "UPI" },
	{ value: "bank_transfer", label: "Bank Transfer" },
	{ value: "cheque", label: "Cheque" },
	{ value: "card", label: "Card" },
	{ value: "other", label: "Other" },
];

export function PaymentsFilters() {
	const {
		filters,
		setFilter,
		resetFilters,
		isFiltered,
		activeViewId,
		applyView,
		sortingState,
		columnVisibility,
	} = usePaymentsTableWithViews();

	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
			{
				id: "paymentMethod",
				label: "Method",
				variant: "multiSelect",
				icon: CreditCardIcon,
				options: PAYMENT_METHOD_OPTIONS,
			},
		],
		[],
	);

	const filterValues = useMemo(
		() => ({
			paymentMethod: filters.paymentMethod ?? [],
		}),
		[filters.paymentMethod],
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
			if (filterId === "paymentMethod") {
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

	return (
		<DataTableToolbarWithViews
			entityType="payment"
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
			searchPlaceholder="Search payments..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		/>
	);
}
