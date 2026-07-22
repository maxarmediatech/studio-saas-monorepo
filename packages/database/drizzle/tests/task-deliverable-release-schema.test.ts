import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

interface JournalEntry {
	idx: number;
	tag: string;
	when: number;
}

async function readMigrationHash(tag: string): Promise<string> {
	const migration = await readFile(
		new URL(`../migrations/${tag}.sql`, import.meta.url),
	);
	return createHash("sha256").update(migration).digest("hex");
}

function ledgerDigest(hashes: string[]): string {
	return createHash("md5").update(hashes.join(",")).digest("hex");
}

test("task-driven deliverable release gates match the migration ledger", async () => {
	const journal = JSON.parse(
		await readFile(
			new URL("../migrations/meta/_journal.json", import.meta.url),
			"utf8",
		),
	) as { entries: JournalEntry[] };
	const hashes = await Promise.all(
		journal.entries.map((entry) => readMigrationHash(entry.tag)),
	);
	const startEntries = journal.entries.slice(0, 46);
	const startEntry = startEntries[startEntries.length - 1];
	const finalEntry = journal.entries[journal.entries.length - 1];

	assert.equal(startEntry?.tag, "0045_better_auth_two_factor_lockout");
	assert.equal(startEntry?.when, 1784550431955);
	assert.equal(
		hashes[45],
		"ce5f921d6ca7f0aa29fe627853fa15075261fb2ba0f1ec0760eff68b8945c166",
	);
	assert.equal(
		ledgerDigest(hashes.slice(0, 46)),
		"6008232e9e0eeb05362ead618f145128",
	);

	assert.equal(journal.entries.length, 50);
	assert.equal(finalEntry?.tag, "0049_repair_stale_deliverable_task_links");
	assert.equal(finalEntry?.when, 1784752206666);
	assert.equal(
		hashes[hashes.length - 1],
		"9f8143074b242b48b5cf4c0034e2d13b8359cc911e416ef278b50c7bda4f7ffe",
	);
	assert.equal(ledgerDigest(hashes), "6b988d4bb573534343a4cf3c5041ac47");

	const preflight = await readFile(
		new URL(
			"../preflight/0046_task_driven_deliverables.sql",
			import.meta.url,
		),
		"utf8",
	);
	const cutover = await readFile(
		new URL(
			"../preflight/0049_task_driven_deliverables_cutover.sql",
			import.meta.url,
		),
		"utf8",
	);

	for (const expected of [
		"ledger.row_count = 46",
		"1784550431955",
		"ce5f921d6ca7f0aa29fe627853fa15075261fb2ba0f1ec0760eff68b8945c166",
		"6008232e9e0eeb05362ead618f145128",
		"repairable_deleted_task_reference_count = 2",
		"unsafe_deleted_task_reference_count = 0",
	]) {
		assert.match(preflight, new RegExp(expected));
	}
	for (const expected of [
		"ledger.row_count = 50",
		"1784752206666",
		"9f8143074b242b48b5cf4c0034e2d13b8359cc911e416ef278b50c7bda4f7ffe",
		"6b988d4bb573534343a4cf3c5041ac47",
	]) {
		assert.match(cutover, new RegExp(expected));
	}
});
