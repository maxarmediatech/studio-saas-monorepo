export function shouldAutosaveQuotationDraft(input: {
	loaded: boolean;
	dirty: boolean;
	conflictPaused: boolean;
}): boolean {
	return input.loaded && input.dirty && !input.conflictPaused;
}
