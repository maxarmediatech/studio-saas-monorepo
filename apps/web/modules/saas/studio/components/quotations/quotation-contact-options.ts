export function canOfferCreateLead(
	query: string,
	resultNames: string[],
	isFetching: boolean,
	isLoaded: boolean,
): boolean {
	const normalizedQuery = query.trim().toLocaleLowerCase();
	return (
		Boolean(normalizedQuery) &&
		!isFetching &&
		isLoaded &&
		!resultNames.some(
			(name) => name.trim().toLocaleLowerCase() === normalizedQuery,
		)
	);
}

export function getQuotationContactEnterAction(
	activeIndex: number,
	resultCount: number,
	hasCreateOption: boolean,
): "select" | "create" | "none" {
	if (activeIndex >= 0 && activeIndex < resultCount) {
		return "select";
	}
	return activeIndex === resultCount && hasCreateOption ? "create" : "none";
}
