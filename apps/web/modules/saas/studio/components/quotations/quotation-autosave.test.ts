import { describe, expect, it, vi } from "vitest";
import {
	createQuotationAutosaveState,
	markQuotationAutosaveEdit,
	runQuotationAutosave,
	shouldRunQuotationAutosave,
} from "./quotation-autosave";

type Draft = {
	name: string;
	email: string;
	phone: string;
	clientId: string | null;
};

describe("quotation autosave", () => {
	it("serializes progressive contact edits and preserves returned identity", async () => {
		const initial: Draft = {
			name: "Client one",
			email: "",
			phone: "",
			clientId: null,
		};
		const state = createQuotationAutosaveState(initial);
		markQuotationAutosaveEdit(state, initial);
		let releaseFirst: ((value: { clientId: string }) => void) | undefined;
		let concurrent = 0;
		let maximumConcurrent = 0;
		let quoteCreates = 0;
		let leadCreates = 0;
		const save = vi.fn(async (snapshot: Draft) => {
			if (!snapshot.clientId) {
				quoteCreates += 1;
				leadCreates += 1;
			}
			concurrent += 1;
			maximumConcurrent = Math.max(maximumConcurrent, concurrent);
			const result = await (save.mock.calls.length === 1
				? new Promise<{ clientId: string }>((resolve) => {
						releaseFirst = resolve;
					})
				: Promise.resolve({ clientId: snapshot.clientId ?? "lead-1" }));
			concurrent -= 1;
			return result;
		});
		const persist = runQuotationAutosave(state, save, (latest, result) => ({
			...latest,
			clientId: result.clientId,
		}));
		markQuotationAutosaveEdit(state, {
			...initial,
			email: "client@example.com",
			phone: "+919876543210",
		});
		releaseFirst?.({ clientId: "lead-1" });
		await persist;

		expect(maximumConcurrent).toBe(1);
		expect(quoteCreates).toBe(1);
		expect(leadCreates).toBe(1);
		expect(save).toHaveBeenCalledTimes(2);
		expect(save.mock.calls[1]?.[0]).toEqual({
			...initial,
			email: "client@example.com",
			phone: "+919876543210",
			clientId: "lead-1",
		});
	});

	it("does not repeat an unchanged failed snapshot", async () => {
		const state = createQuotationAutosaveState({ value: "duplicate" });
		markQuotationAutosaveEdit(state, state.snapshot);
		const save = vi.fn().mockRejectedValue(new Error("409 conflict"));

		await expect(
			runQuotationAutosave(state, save, (latest) => latest),
		).rejects.toThrow("409");
		expect(shouldRunQuotationAutosave(state)).toBe(false);
		expect(
			await runQuotationAutosave(state, save, (latest) => latest),
		).toBeNull();
		expect(save).toHaveBeenCalledTimes(1);
		markQuotationAutosaveEdit(state, { value: "selected-record" });
		expect(shouldRunQuotationAutosave(state)).toBe(true);
		await expect(
			runQuotationAutosave(state, save, (latest) => latest),
		).rejects.toThrow("409");
		expect(save).toHaveBeenCalledTimes(2);
	});
});
