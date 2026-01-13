export const STICKY_COLORS = {
	yellow: {
		bg: "bg-yellow-100",
		border: "border-yellow-200",
		name: "Yellow",
	},
	blue: { bg: "bg-blue-100", border: "border-blue-200", name: "Blue" },
	green: { bg: "bg-green-100", border: "border-green-200", name: "Green" },
	pink: { bg: "bg-pink-100", border: "border-pink-200", name: "Pink" },
	purple: {
		bg: "bg-purple-100",
		border: "border-purple-200",
		name: "Purple",
	},
	orange: {
		bg: "bg-orange-100",
		border: "border-orange-200",
		name: "Orange",
	},
	gray: { bg: "bg-gray-100", border: "border-gray-200", name: "Gray" },
} as const;

export type StickyColor = keyof typeof STICKY_COLORS;
