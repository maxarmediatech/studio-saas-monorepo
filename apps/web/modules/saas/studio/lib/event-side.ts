export const EVENT_SIDE_OPTIONS = [
	{ value: "common", label: "Common" },
	{ value: "bride", label: "Bride side" },
	{ value: "groom", label: "Groom side" },
	{ value: "both", label: "Both sides" },
	{ value: "separateCommon", label: "Separate common" },
] as const;

export type EventSide = (typeof EVENT_SIDE_OPTIONS)[number]["value"];

export function getEventSideLabel(side: EventSide | null | undefined) {
	return EVENT_SIDE_OPTIONS.find((option) => option.value === side)?.label;
}
