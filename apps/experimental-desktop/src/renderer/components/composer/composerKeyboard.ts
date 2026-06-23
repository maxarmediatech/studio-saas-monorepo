import type { ComposerCommand } from "./composerTriggers";

export function nextSelectableIndex(
	items: ComposerCommand[],
	currentIndex: number,
	direction: 1 | -1,
) {
	if (items.length === 0) {
		return 0;
	}
	let nextIndex = currentIndex;
	for (let count = 0; count < items.length; count += 1) {
		nextIndex = (nextIndex + direction + items.length) % items.length;
		if (!items[nextIndex]?.disabled) {
			return nextIndex;
		}
	}
	return currentIndex;
}
