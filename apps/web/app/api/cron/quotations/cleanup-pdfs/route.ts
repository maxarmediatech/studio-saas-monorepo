import { timingSafeEqual } from "node:crypto";
import { cleanupUnreferencedQuotationPdfs } from "@repo/api/modules/quotes/lib/quotation-pdf-cleanup";
import { NextResponse } from "next/server";

function secureCompare(left: string, right: string): boolean {
	return (
		left.length === right.length &&
		timingSafeEqual(Buffer.from(left), Buffer.from(right))
	);
}

export async function POST(request: Request) {
	const secret = process.env.CRON_SECRET;
	const authorization = request.headers.get("authorization");
	const token = authorization?.startsWith("Bearer ")
		? authorization.slice(7)
		: null;
	if (!secret || !token || !secureCompare(token, secret)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const result = await cleanupUnreferencedQuotationPdfs();
	return NextResponse.json({ success: true, ...result });
}
