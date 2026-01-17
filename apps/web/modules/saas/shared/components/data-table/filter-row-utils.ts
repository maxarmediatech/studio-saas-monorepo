import type { ComponentType } from "react";
import type {
	ToolbarFilterConfig,
	ToolbarFilterValues,
} from "./DataTableToolbar";

export interface FilterChipModel {
	id: string;
	field: string;
	operator: string;
	valueText: string;
	icon?: ComponentType<{ className?: string }>;
}

export function isFilterActive(
	value: ToolbarFilterValues[string],
	_variant?: ToolbarFilterConfig["variant"],
): boolean {
	if (value == null) {
		return false;
	}

	if (Array.isArray(value)) {
		return value.length > 0;
	}

	if (typeof value === "object") {
		const dateRange = value as { from?: string; to?: string };
		return !!(dateRange.from || dateRange.to);
	}

	return value !== "";
}

export function formatFilterChip(
	config: ToolbarFilterConfig,
	value: ToolbarFilterValues[string],
): FilterChipModel | null {
	if (!isFilterActive(value, config.variant)) {
		return null;
	}

	let operator = "is";
	let valueText = "";

	if (Array.isArray(value)) {
		operator = value.length > 1 ? "is any of" : "is";
		valueText = value
			.map((v) => config.options?.find((o) => o.value === v)?.label ?? v)
			.join(", ");

		if (value.length > 3) {
			const firstTwo = value
				.slice(0, 2)
				.map(
					(v) =>
						config.options?.find((o) => o.value === v)?.label ?? v,
				)
				.join(", ");
			valueText = `${firstTwo} +${value.length - 2} more`;
		}
	} else if (typeof value === "object" && value !== null) {
		const dateRange = value as { from?: string; to?: string };
		if (dateRange.from && dateRange.to) {
			operator = "between";
			valueText = `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`;
		} else if (dateRange.from) {
			operator = "after";
			valueText = formatDate(dateRange.from);
		} else if (dateRange.to) {
			operator = "before";
			valueText = formatDate(dateRange.to);
		}
	} else {
		const opt = config.options?.find((o) => o.value === value);
		valueText = opt?.label ?? String(value);

		if (config.variant === "date" && typeof value === "string") {
			valueText = formatDate(value);
		}
	}

	return {
		id: config.id,
		field: config.label,
		operator,
		valueText,
		icon: config.icon,
	};
}

export function buildActiveChips(
	configs: ToolbarFilterConfig[],
	values: ToolbarFilterValues,
): FilterChipModel[] {
	return configs
		.map((config) => formatFilterChip(config, values[config.id]))
		.filter((chip): chip is FilterChipModel => chip !== null);
}

export function normalizeForCompare(state: {
	filters: Record<string, unknown>;
	sorting?: Array<{ id: string; desc: boolean }> | null;
	columnVisibility?: Record<string, boolean> | null;
}): string {
	const normalized = {
		filters: Object.fromEntries(
			Object.entries(state.filters ?? {})
				.filter(([, v]) => {
					if (v == null || v === "") {
						return false;
					}
					if (Array.isArray(v)) {
						return v.length > 0;
					}
					if (typeof v === "object") {
						const obj = v as Record<string, unknown>;
						return Object.values(obj).some(
							(val) => val != null && val !== "",
						);
					}
					return true;
				})
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([k, v]) => {
					if (Array.isArray(v)) {
						return [k, [...v].sort()];
					}
					return [k, v];
				}),
		),
		sorting: state.sorting ?? [],
		columnVisibility: state.columnVisibility
			? Object.fromEntries(
					Object.entries(state.columnVisibility).sort(([a], [b]) =>
						a.localeCompare(b),
					),
				)
			: {},
	};

	return JSON.stringify(normalized);
}

function formatDate(dateStr: string): string {
	try {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	} catch {
		return dateStr;
	}
}
