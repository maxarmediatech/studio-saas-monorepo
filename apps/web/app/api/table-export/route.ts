import { auth } from "@repo/auth";
import { NextResponse } from "next/server";
import { TABLE_EXPORT_ENTITIES, TABLE_EXPORT_FORMATS, type TableExportRequest } from "@/modules/saas/shared/lib/table-export/types";
import { createTableExport } from "@/modules/saas/shared/lib/table-export/server";

function isValidExportRequest(body: unknown): body is TableExportRequest {
	if (!body || typeof body !== "object") {
		return false;
	}

	const candidate = body as Record<string, unknown>;
	return (
		typeof candidate.entityType === "string" &&
		TABLE_EXPORT_ENTITIES.includes(candidate.entityType as any) &&
		typeof candidate.format === "string" &&
		TABLE_EXPORT_FORMATS.includes(candidate.format as any) &&
		typeof candidate.input === "object" &&
		candidate.input !== null
	);
}

export async function POST(request: Request) {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session?.user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
	}

	if (!isValidExportRequest(body)) {
		return NextResponse.json({ message: "Invalid export request" }, { status: 400 });
	}

	try {
		const result = await createTableExport(request.headers, body);
		return new Response(result.body as BodyInit, {
			headers: {
				"Content-Type": result.contentType,
				"Content-Disposition": `attachment; filename="${result.filename}"`,
				"Cache-Control": "private, no-store",
			},
		});
	} catch (error) {
		console.error("Table export failed", error);
		return NextResponse.json({ message: "Failed to export table data" }, { status: 500 });
	}
}
