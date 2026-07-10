import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
	createPaymentSubmissionKeyStore,
	type SubmissionKeyStorage,
} from "./payment-submission-key-store";

function memoryStorage(): SubmissionKeyStorage {
	const values = new Map<string, string>();
	return {
		getItem: (key) => values.get(key) ?? null,
		removeItem: (key) => values.delete(key),
		setItem: (key, value) => values.set(key, value),
	};
}

function keyGenerator(...keys: string[]) {
	let index = 0;
	return () => keys[index++] ?? `key-${index}`;
}

describe("payment submission key store", () => {
	it("reuses a pending key after remount and property reordering", () => {
		const storage = memoryStorage();
		const first = createPaymentSubmissionKeyStore({
			namespace: "org-1:create-payment",
			storage: () => storage,
			generateKey: keyGenerator("first-key"),
		});
		assert.equal(
			first.keyFor({ amount: "10.00", bookingId: "booking-1" }),
			"first-key",
		);

		const remounted = createPaymentSubmissionKeyStore({
			namespace: "org-1:create-payment",
			storage: () => storage,
			generateKey: keyGenerator("should-not-be-used"),
		});
		assert.equal(
			remounted.keyFor({ bookingId: "booking-1", amount: "10.00" }),
			"first-key",
		);
	});

	it("rotates for changed payloads and after success or abandonment", () => {
		const storage = memoryStorage();
		const store = createPaymentSubmissionKeyStore({
			namespace: "org-1:create-payment",
			storage: () => storage,
			generateKey: keyGenerator("one", "two", "three", "four"),
		});
		assert.equal(store.keyFor({ amount: "10.00" }), "one");
		assert.equal(store.keyFor({ amount: "11.00" }), "two");
		store.acknowledgeSuccess();
		assert.equal(store.keyFor({ amount: "11.00" }), "three");
		store.abandon();
		assert.equal(store.keyFor({ amount: "11.00" }), "four");
	});

	it("isolates operation namespaces in the same tab", () => {
		const storage = memoryStorage();
		const create = createPaymentSubmissionKeyStore({
			namespace: "org-1:create-payment",
			storage: () => storage,
			generateKey: keyGenerator("create-key"),
		});
		const convert = createPaymentSubmissionKeyStore({
			namespace: "org-1:convert-schedule",
			storage: () => storage,
			generateKey: keyGenerator("convert-key"),
		});

		assert.equal(create.keyFor({ amount: "10.00" }), "create-key");
		assert.equal(convert.keyFor({ amount: "10.00" }), "convert-key");
	});

	it("isolates the same submission between browser tabs", () => {
		const firstTabStorage = memoryStorage();
		const secondTabStorage = memoryStorage();
		const firstTab = createPaymentSubmissionKeyStore({
			namespace: "org-1:create-payment",
			storage: () => firstTabStorage,
			generateKey: keyGenerator("first-tab-key"),
		});
		const secondTab = createPaymentSubmissionKeyStore({
			namespace: "org-1:create-payment",
			storage: () => secondTabStorage,
			generateKey: keyGenerator("second-tab-key"),
		});

		assert.equal(firstTab.keyFor({ amount: "10.00" }), "first-tab-key");
		assert.equal(secondTab.keyFor({ amount: "10.00" }), "second-tab-key");
	});

	it("replaces corrupt state and falls back when storage is unavailable", () => {
		const corrupt = memoryStorage();
		corrupt.setItem(
			"stuwiz:payment-submission:v1:org-1:create-payment",
			"not-json",
		);
		const recovered = createPaymentSubmissionKeyStore({
			namespace: "org-1:create-payment",
			storage: () => corrupt,
			generateKey: keyGenerator("recovered-key"),
		});
		assert.equal(recovered.keyFor({ amount: "10.00" }), "recovered-key");

		const unavailable = createPaymentSubmissionKeyStore({
			namespace: "org-1:convert-schedule",
			storage: () => {
				throw new Error("storage disabled");
			},
			generateKey: keyGenerator("memory-key", "unexpected"),
		});
		assert.equal(unavailable.keyFor({ amount: "10.00" }), "memory-key");
		assert.equal(unavailable.keyFor({ amount: "10.00" }), "memory-key");
	});
});
