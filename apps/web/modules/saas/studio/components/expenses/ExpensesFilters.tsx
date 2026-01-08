"use client";

import {
	DataTableToolbar,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import { useExpensesTable } from "@saas/studio/hooks/tables";
import { CreditCardIcon, UserIcon } from "lucide-react";
import { useMemo } from "react";

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
	// Use the expenses table hook for URL-synced state
	const { filters, setFilter, resetFilters, isFiltered } = useExpensesTable();

	// Define filter configurations
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
		],
		[],
	);

	// Convert filters to toolbar format
	const filterValues = useMemo(
		() => ({
			billTo: filters.billTo ?? [],
			paymentMethod: filters.paymentMethod ?? [],
		}),
		[filters.billTo, filters.paymentMethod],
	);

	// Handle filter changes
	const handleFilterChange = (
		filterId: string,
		value:
			| string
			| string[]
			| { from?: string; to?: string }
			| null
			| undefined,
	) => {
		if (filterId === "billTo") {
			const values =
				Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("billTo", values);
		} else if (filterId === "paymentMethod") {
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
			searchPlaceholder="Search expenses..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		/>
	);
}
