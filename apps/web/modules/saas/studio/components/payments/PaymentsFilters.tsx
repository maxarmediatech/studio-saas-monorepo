"use client";

import {
	DataTableToolbar,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import { usePaymentsTable } from "@saas/studio/hooks/tables";
import { CreditCardIcon } from "lucide-react";
import { useMemo } from "react";

/**
 * Payment method options for the payment method filter.
 */
const PAYMENT_METHOD_OPTIONS = [
	{ value: "cash", label: "Cash" },
	{ value: "upi", label: "UPI" },
	{ value: "bank_transfer", label: "Bank Transfer" },
	{ value: "cheque", label: "Cheque" },
	{ value: "card", label: "Card" },
	{ value: "other", label: "Other" },
];

export function PaymentsFilters() {
	// Use the payments table hook for URL-synced state
	const { filters, setFilter, resetFilters, isFiltered } = usePaymentsTable();

	// Define filter configurations
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

	// Convert filters to toolbar format
	const filterValues = useMemo(
		() => ({
			paymentMethod: filters.paymentMethod ?? [],
		}),
		[filters.paymentMethod],
	);

	// Handle filter changes
	const handleFilterChange = (
		filterId: string,
		value: string | string[] | { from?: string; to?: string } | null | undefined,
	) => {
		if (filterId === "paymentMethod") {
			const values =
				Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("paymentMethod", values);
		}
	};

	// Handle search changes
	const handleSearchChange = (value: string) => {
		setFilter("search", value || null);
	};

	return (
		<DataTableToolbar
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
