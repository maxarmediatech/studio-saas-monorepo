import {
	buildQuotationEditorHandoffRequest,
	createRemoteQuotationEditorHandoff,
} from "@repo/api/modules/quotes/lib/quotation-editor-handoff";
import { resolveQuotationBranding } from "@repo/api/modules/quotes/lib/quotation-pdf-service";
import { auth } from "@repo/auth";
import { and, db, eq, isNull, quotes } from "@repo/database";
import { env } from "@repo/env";
import { NextResponse } from "next/server";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ quoteId: string }> },
) {
	const origin = request.headers.get("Origin");
	if (origin && origin !== new URL(request.url).origin) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}
	const session = await auth.api.getSession({ headers: request.headers });
	const organizationId = session?.session.activeOrganizationId;
	if (!session?.user || !organizationId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const permission = await auth.api.hasPermission({
		headers: request.headers,
		body: {
			organizationId,
			permissions: { quote: ["readOperational"] },
		},
	});
	if (!permission?.success) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}
	if (!env.STUDIO_EDITOR_URL || !env.STUDIO_EDITOR_HANDOFF_SECRET) {
		return NextResponse.json(
			{ error: "Quotation editor is not configured" },
			{ status: 503 },
		);
	}
	const { quoteId } = await params;
	const quote = await db.query.quotes.findFirst({
		where: and(
			eq(quotes.id, quoteId),
			eq(quotes.organizationId, organizationId),
			isNull(quotes.deletedAt),
		),
		columns: {
			id: true,
			quoteNumber: true,
			version: true,
			documentVersion: true,
			documentRevision: true,
			document: true,
			expiresAt: true,
			createdAt: true,
		},
	});
	if (!quote) {
		return NextResponse.json(
			{ error: "Quotation not found" },
			{ status: 404 },
		);
	}
	if (quote.documentVersion !== 1 || !quote.document) {
		return NextResponse.json(
			{ error: "This quotation cannot be opened in Studio" },
			{ status: 409 },
		);
	}

	try {
		const { branding } = await resolveQuotationBranding(organizationId);
		const handoff = buildQuotationEditorHandoffRequest({
			quote,
			branding,
		});
		const editorUrl = await createRemoteQuotationEditorHandoff({
			editorUrl: env.STUDIO_EDITOR_URL,
			secret: env.STUDIO_EDITOR_HANDOFF_SECRET,
			request: handoff,
		});
		return NextResponse.json(
			{ data: { editorUrl } },
			{ headers: { "Cache-Control": "no-store" } },
		);
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Could not open quotation in Studio",
			},
			{ status: 502 },
		);
	}
}
