export const SNAPSHOT_MANIFEST_VERSION = 2;
export const SANITIZER_REVIEWED_SNAPSHOT_TAG = "0054_thankful_forgotten_one";

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
