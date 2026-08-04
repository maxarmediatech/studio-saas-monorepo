export type QuotationAutosaveState<TDraft> = {
	snapshot: TDraft;
	editVersion: number;
	savedVersion: number;
	failedVersion: number | null;
	inFlight: Promise<unknown> | null;
};

export function createQuotationAutosaveState<TDraft>(
	snapshot: TDraft,
): QuotationAutosaveState<TDraft> {
	return {
		snapshot,
		editVersion: 0,
		savedVersion: -1,
		failedVersion: null,
		inFlight: null,
	};
}

export function markQuotationAutosaveEdit<TDraft>(
	state: QuotationAutosaveState<TDraft>,
	snapshot: TDraft,
) {
	state.snapshot = snapshot;
	state.editVersion += 1;
}

export function markQuotationAutosaveLoaded<TDraft>(
	state: QuotationAutosaveState<TDraft>,
	snapshot: TDraft,
) {
	state.snapshot = snapshot;
	state.savedVersion = state.editVersion;
	state.failedVersion = null;
}

export function shouldRunQuotationAutosave<TDraft>(
	state: QuotationAutosaveState<TDraft>,
): boolean {
	return (
		state.savedVersion !== state.editVersion &&
		state.failedVersion !== state.editVersion
	);
}

export async function runQuotationAutosave<TDraft, TResult>(
	state: QuotationAutosaveState<TDraft>,
	save: (snapshot: TDraft) => Promise<TResult>,
	mergeSavedResult: (latest: TDraft, result: TResult) => TDraft,
): Promise<TResult | null> {
	if (state.inFlight) {
		return state.inFlight as Promise<TResult | null>;
	}
	if (!shouldRunQuotationAutosave(state)) {
		return null;
	}

	const operation = (async () => {
		let latestResult: TResult | null = null;
		while (state.savedVersion < state.editVersion) {
			const capturedVersion = state.editVersion;
			const capturedSnapshot = state.snapshot;
			try {
				latestResult = await save(capturedSnapshot);
			} catch (error) {
				state.failedVersion = capturedVersion;
				throw error;
			}
			state.snapshot = mergeSavedResult(state.snapshot, latestResult);
			state.savedVersion = capturedVersion;
			state.failedVersion = null;
		}
		return latestResult;
	})();
	state.inFlight = operation;
	try {
		return await operation;
	} finally {
		state.inFlight = null;
	}
}
