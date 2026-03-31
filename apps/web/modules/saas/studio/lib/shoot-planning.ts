import type { MultiSelectOption } from "@repo/ui/components/multi-select-combobox";

export const SHOOT_EXTRA_SERVICE_OPTIONS = [
	{
		value: "drone_service",
		label: "Drone Service",
	},
] as const satisfies readonly MultiSelectOption[];

const SHOOT_EXTRA_SERVICE_LABELS = new Map<string, string>(
	SHOOT_EXTRA_SERVICE_OPTIONS.map((option) => [option.value, option.label]),
);

export function getShootExtraServiceLabel(serviceKey: string): string {
	return SHOOT_EXTRA_SERVICE_LABELS.get(serviceKey) ?? serviceKey;
}
