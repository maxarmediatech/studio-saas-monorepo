"use client";

import type { ToolbarFilterConfig } from "@saas/shared/components/data-table";
import { DataTableToolbarWithViews } from "@saas/shared/components/data-table";
import type { SavedView } from "@saas/shared/components/views";
import { useExpensesTableWithViews } from "@saas/studio/hooks/tables";
import { bookingsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
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
		sortingState,
		columnVisibility,
	} = useExpensesTableWithViews();
	const { data: bookingsData } = useQuery(
		bookingsApi.listOptions({ limit: 100 }),
	);

	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
			{
				id: "bookingId",
				label: "Booking",
				variant: "select",
				options: (bookingsData?.data ?? []).map((booking) => ({
					value: booking.id,
					label: `${booking.name} (${booking.referenceNumber})`,
				})),
			},
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
		[bookingsData],
	);

	const filterValues = useMemo(
		() => ({
			bookingId: filters.bookingId ?? null,
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
				const bookingId = Array.isArray(value)
					? (value[0] ?? null)
					: typeof value === "string"
						? value
						: null;
				setFilter("bookingId", bookingId);
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
		/>
	);
}
