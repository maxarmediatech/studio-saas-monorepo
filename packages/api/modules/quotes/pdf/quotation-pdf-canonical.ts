interface PdfXrefEntry {
	generation: number;
	offset: number;
	inUse: boolean;
}

const endOfPdfPattern = /startxref\s+(\d+)\s+%%EOF\s*$/;
const xrefPattern =
	/^xref\r?\n0 (\d+)\r?\n((?:\d{10} \d{5} [fn] \r?\n)+)trailer\r?\n([\s\S]*?)\r?\nstartxref/;

function parseXref(source: string): {
	entries: PdfXrefEntry[];
	trailer: string;
	xrefOffset: number;
} {
	const end = source.match(endOfPdfPattern);
	if (!end?.[1]) {
		throw new Error("Quotation PDF has no readable startxref marker");
	}
	const xrefOffset = Number.parseInt(end[1], 10);
	const xref = source.slice(xrefOffset).match(xrefPattern);
	if (!xref?.[1] || !xref[2] || xref[3] === undefined) {
		throw new Error(
			"Quotation PDF does not use the expected classic xref table",
		);
	}
	const count = Number.parseInt(xref[1], 10);
	const entries = [...xref[2].matchAll(/(\d{10}) (\d{5}) ([fn])/g)].map(
		(match) => ({
			offset: Number.parseInt(match[1] ?? "0", 10),
			generation: Number.parseInt(match[2] ?? "0", 10),
			inUse: match[3] === "n",
		}),
	);
	if (entries.length !== count) {
		throw new Error("Quotation PDF xref entry count is inconsistent");
	}
	return { entries, trailer: xref[3], xrefOffset };
}

/**
 * PDFKit may flush completed page streams in a different physical order even
 * when their object numbers and contents are identical. Reordering indirect
 * objects by number and rebuilding the classic xref makes identical renders
 * byte-stable before content-addressed storage.
 */
export function canonicalizeQuotationPdf(bytes: Buffer): Buffer {
	const source = bytes.toString("latin1");
	const { entries, trailer, xrefOffset } = parseXref(source);
	const objects = entries
		.map((entry, objectNumber) => ({ ...entry, objectNumber }))
		.filter((entry) => entry.inUse);
	const physicalOrder = [...objects].sort(
		(left, right) => left.offset - right.offset,
	);
	const slices = new Map<number, string>();
	for (const [index, entry] of physicalOrder.entries()) {
		const end = physicalOrder[index + 1]?.offset ?? xrefOffset;
		slices.set(
			entry.objectNumber,
			source.slice(entry.offset, end).trimEnd(),
		);
	}
	const firstOffset = physicalOrder[0]?.offset;
	if (firstOffset === undefined) {
		throw new Error("Quotation PDF contains no indirect objects");
	}
	let canonical = `${source.slice(0, firstOffset).trimEnd()}\n`;
	const offsets = new Map<number, number>();
	for (const entry of [...objects].sort(
		(left, right) => left.objectNumber - right.objectNumber,
	)) {
		offsets.set(entry.objectNumber, Buffer.byteLength(canonical, "latin1"));
		canonical += `${slices.get(entry.objectNumber) ?? ""}\n`;
	}
	const canonicalXrefOffset = Buffer.byteLength(canonical, "latin1");
	canonical += `xref\n0 ${entries.length}\n`;
	for (const [objectNumber, entry] of entries.entries()) {
		const offset = entry.inUse
			? (offsets.get(objectNumber) ?? 0)
			: entry.offset;
		canonical += `${String(offset).padStart(10, "0")} ${String(entry.generation).padStart(5, "0")} ${entry.inUse ? "n" : "f"} \n`;
	}
	canonical += `trailer\n${trailer}\nstartxref\n${canonicalXrefOffset}\n%%EOF\n`;
	return Buffer.from(canonical, "latin1");
}
