export const STICKY_COLORS = {
	gray: {
		key: "gray",
		label: "Gray",
		backgroundColor: "var(--sticky-gray)",
	},
	peach: {
		key: "peach",
		label: "Peach",
		backgroundColor: "var(--sticky-peach)",
	},
	pink: {
		key: "pink",
		label: "Pink",
		backgroundColor: "var(--sticky-pink)",
	},
	orange: {
		key: "orange",
		label: "Orange",
		backgroundColor: "var(--sticky-orange)",
	},
	green: {
		key: "green",
		label: "Green",
		backgroundColor: "var(--sticky-green)",
	},
	"light-blue": {
		key: "light-blue",
		label: "Light Blue",
		backgroundColor: "var(--sticky-light-blue)",
	},
	"dark-blue": {
		key: "dark-blue",
		label: "Dark Blue",
		backgroundColor: "var(--sticky-dark-blue)",
	},
	purple: {
		key: "purple",
		label: "Purple",
		backgroundColor: "var(--sticky-purple)",
	},
	yellow: {
		key: "yellow",
		label: "Yellow",
		backgroundColor: "var(--sticky-yellow)",
	},
} as const;

export type StickyColor = keyof typeof STICKY_COLORS;

export const STICKY_COLORS_LIST = Object.values(STICKY_COLORS);

export function getRandomStickyColor(): StickyColor {
	const colors = Object.keys(STICKY_COLORS) as StickyColor[];
	return colors[Math.floor(Math.random() * colors.length)];
}
