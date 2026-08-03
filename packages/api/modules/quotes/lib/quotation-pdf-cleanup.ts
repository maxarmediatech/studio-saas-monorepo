import { db, isNotNull, quoteAcceptances, quotes } from "@repo/database";
import { getUploadsBucketName } from "@repo/env";
import { deleteObject, listObjects } from "@repo/storage";
import { quotationPdfSnapshotV1Schema } from "../../studio/schemas/quotation-document";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function selectUnreferencedQuotationPdfKeys(
	objects: Array<{ key: string; lastModified: Date | null }>,
	referencedKeys: ReadonlySet<string>,
	cutoff: Date,
): string[] {
	return objects.flatMap((object) =>
		object.key.startsWith("quotations/") &&
		object.lastModified &&
		object.lastModified < cutoff &&
		!referencedKeys.has(object.key)
			? [object.key]
			: [],
	);
}

export async function cleanupUnreferencedQuotationPdfs(
	now = new Date(),
): Promise<{ scanned: number; deleted: number }> {
	const [quoteRows, acceptanceRows] = await Promise.all([
		db
			.select({ key: quotes.pdfStorageKey })
			.from(quotes)
			.where(isNotNull(quotes.pdfStorageKey)),
		db
			.select({ snapshot: quoteAcceptances.pdfSnapshot })
			.from(quoteAcceptances)
			.where(isNotNull(quoteAcceptances.pdfSnapshot)),
	]);
	const referenced = new Set(
		quoteRows.flatMap(({ key }) => (key ? [key] : [])),
	);
	for (const row of acceptanceRows) {
		const snapshot = quotationPdfSnapshotV1Schema.safeParse(row.snapshot);
		if (snapshot.success) {
			referenced.add(snapshot.data.storageKey);
		}
	}
	const bucket = getUploadsBucketName();
	const cutoff = new Date(now.getTime() - ONE_DAY_MS);
	let continuationToken: string | undefined;
	let scanned = 0;
	let deleted = 0;
	do {
		const page = await listObjects("quotations/", {
			bucket,
			continuationToken,
		});
		scanned += page.objects.length;
		const keys = selectUnreferencedQuotationPdfKeys(
			page.objects,
			referenced,
			cutoff,
		);
		for (const key of keys) {
			await deleteObject(key, { bucket });
			deleted += 1;
		}
		continuationToken = page.nextContinuationToken;
	} while (continuationToken);
	return { scanned, deleted };
}
