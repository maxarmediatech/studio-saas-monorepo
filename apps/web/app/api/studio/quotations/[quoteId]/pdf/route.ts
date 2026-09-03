import {
	readStoredQuotationPdf,
	renderDraftQuotationPdf,
} from "@repo/api/modules/quotes/lib/quotation-pdf-service";
import { auth } from "@repo/auth";
import { and, db, eq, quotes } from "@repo/database";
import {
	requestedQuotationPresentation,
	requestedQuotationRevision,
} from "@saas/studio/components/quotations/quotation-pdf-route";
import { NextResponse } from "next/server";

function safeFilename(quoteNumber: string, version: number): string {
	const stem = `${quoteNumber}-v${version}`
		.normalize("NFKD")
		.replace(/[^a-zA-Z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 120);
	return `${stem || "quotation"}.pdf`;
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ quoteId: string }> },
) {
	const session = await auth.api.getSession({ headers: request.headers });
	const organizationId = session?.session.activeOrganizationId;
	if (!session?.user || !organizationId) {
		return new NextResponse("Unauthorized", { status: 401 });
	}
	const permission = await auth.api.hasPermission({
		headers: request.headers,
		body: {
			organizationId,
			permissions: { quote: ["readOperational"] },
		},
	});
	if (!permission?.success) {
		return new NextResponse("Forbidden", { status: 403 });
	}
	const { quoteId } = await params;
	const quote = await db.query.quotes.findFirst({
		where: and(
			eq(quotes.id, quoteId),
			eq(quotes.organizationId, organizationId),
		),
		columns: {
			quoteNumber: true,
			version: true,
			status: true,
			documentRevision: true,
		},
	});
	if (!quote) {
		return new NextResponse("Quotation not found", { status: 404 });
	}
	const url = new URL(request.url);
	const requestedRevision = requestedQuotationRevision(
		url.searchParams,
		quote.documentRevision,
	);
	const requestedPresentation = requestedQuotationPresentation(
		url.searchParams,
	);
	if (requestedPresentation.provided && !requestedPresentation.identity) {
		return new NextResponse("Invalid quotation presentation identity", {
			status: 400,
		});
	}
	try {
		const rendered =
			quote.status === "draft"
				? await renderDraftQuotationPdf(
						organizationId,
						quoteId,
						requestedRevision,
						requestedPresentation.identity ?? undefined,
					)
				: await readStoredQuotationPdf(organizationId, quoteId);
		const disposition =
			url.searchParams.get("download") === "1" ? "attachment" : "inline";
		return new NextResponse(new Uint8Array(rendered.bytes), {
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `${disposition}; filename="${safeFilename(quote.quoteNumber, quote.version)}"`,
				"Cache-Control":
					quote.status === "draft"
						? "private, no-store"
						: "private, max-age=31536000, immutable",
				ETag: `"${"identityEtag" in rendered ? rendered.identityEtag : rendered.sha256}"`,
				"Content-Length": rendered.bytes.byteLength.toString(),
			},
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "PDF unavailable";
		return new NextResponse(message, { status: 409 });
	}
}
