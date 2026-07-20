import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { twoFactors } from "../schema/auth";

test("Better Auth two-factor lockout fields stay in schema and migration", async () => {
	const columns = new Map(
		getTableConfig(twoFactors).columns.map((column) => [
			column.name,
			column,
		]),
	);

	assert.equal(columns.get("verified")?.notNull, false);
	assert.equal(columns.get("verified")?.default, true);
	assert.equal(columns.get("failed_verification_count")?.notNull, false);
	assert.equal(columns.get("failed_verification_count")?.default, 0);
	assert.equal(columns.get("locked_until")?.notNull, false);

	const migration = await readFile(
		new URL(
			"../migrations/0045_better_auth_two_factor_lockout.sql",
			import.meta.url,
		),
		"utf8",
	);
	for (const column of [
		'"verified"',
		'"failed_verification_count"',
		'"locked_until"',
	]) {
		assert.match(migration, new RegExp(column));
	}
});
