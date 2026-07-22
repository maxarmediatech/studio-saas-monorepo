export const SNAPSHOT_MANIFEST_VERSION = 1;
export const SANITIZER_REVIEWED_SNAPSHOT_TAG =
	"0049_repair_stale_deliverable_task_links";

export type TableCounts = Record<string, string>;

export type SnapshotManifest = {
	version: typeof SNAPSHOT_MANIFEST_VERSION;
	createdAt: string;
	sourceSchemaFingerprint: string;
	sanitizedSchemaFingerprint: string;
	schemaSnapshotTag: string;
	tableCountsBefore: TableCounts;
	tableCountsAfter: TableCounts;
	clearedTables: string[];
	archiveSha256: string;
	validation: {
		schemaPreserved: true;
		businessRowCountsPreserved: true;
		secretsRemoved: true;
		outboundWorkDisabled: true;
	};
};
