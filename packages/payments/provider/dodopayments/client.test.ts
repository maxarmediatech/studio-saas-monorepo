import assert from "node:assert/strict";
import test from "node:test";
import { getDodoPaymentsEnvironment } from "./client";

test("Dodo environment honors explicit deployment configuration", () => {
	const originalEnvironment = process.env.DODO_PAYMENTS_ENVIRONMENT;
	const originalNodeEnvironment = process.env.NODE_ENV;

	try {
		process.env.NODE_ENV = "production";
		process.env.DODO_PAYMENTS_ENVIRONMENT = "test_mode";
		assert.equal(getDodoPaymentsEnvironment(), "test_mode");

		process.env.NODE_ENV = "development";
		process.env.DODO_PAYMENTS_ENVIRONMENT = "live_mode";
		assert.equal(getDodoPaymentsEnvironment(), "live_mode");

		delete process.env.DODO_PAYMENTS_ENVIRONMENT;
		process.env.NODE_ENV = "production";
		assert.equal(getDodoPaymentsEnvironment(), "live_mode");

		process.env.NODE_ENV = "development";
		assert.equal(getDodoPaymentsEnvironment(), "test_mode");
	} finally {
		if (originalEnvironment === undefined) {
			delete process.env.DODO_PAYMENTS_ENVIRONMENT;
		} else {
			process.env.DODO_PAYMENTS_ENVIRONMENT = originalEnvironment;
		}

		if (originalNodeEnvironment === undefined) {
			delete process.env.NODE_ENV;
		} else {
			process.env.NODE_ENV = originalNodeEnvironment;
		}
	}
});
