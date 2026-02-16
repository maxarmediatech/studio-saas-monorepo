import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	computeNextAttemptAfterFailure,
	hasAttemptsRemaining,
	normalizeAttemptCount,
	normalizeMaxAttempts,
} from "./queue-helpers";

describe("queue helpers", () => {
	it("normalizes invalid attempt inputs", () => {
		assert.equal(normalizeAttemptCount(undefined), 0);
		assert.equal(normalizeAttemptCount(null), 0);
		assert.equal(normalizeAttemptCount(-3), 0);
	});

	it("normalizes invalid maxAttempts to default", () => {
		assert.equal(normalizeMaxAttempts(undefined), 5);
		assert.equal(normalizeMaxAttempts(0), 5);
		assert.equal(normalizeMaxAttempts(-1), 5);
	});

	it("detects exhausted retries", () => {
		assert.equal(
			hasAttemptsRemaining({ attempts: 4, maxAttempts: 5 }),
			true,
		);
		assert.equal(
			hasAttemptsRemaining({ attempts: 5, maxAttempts: 5 }),
			false,
		);
	});

	it("stops scheduling retries after max attempts", () => {
		const now = Date.parse("2026-02-16T12:00:00.000Z");
		assert.equal(
			computeNextAttemptAfterFailure({
				attempts: 5,
				maxAttempts: 5,
				now,
			}),
			null,
		);
	});
});
