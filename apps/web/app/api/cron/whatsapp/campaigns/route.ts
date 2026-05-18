import { timingSafeEqual } from "node:crypto";
import { processDueScheduledCampaigns } from "@repo/api/modules/whatsapp/lib/campaign-engine";
import { NextResponse } from "next/server";

function secureCompare(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: Request) {
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret) {
		console.error("[CRON] CRON_SECRET not configured");
		return NextResponse.json(
			{ error: "Server misconfiguration" },
			{ status: 500 },
		);
	}

	const authHeader = request.headers.get("authorization");
	const token = authHeader?.startsWith("Bearer ")
		? authHeader.slice(7)
		: null;

	if (!token || !secureCompare(token, cronSecret)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const result = await processDueScheduledCampaigns({ limit: 25 });

		return NextResponse.json({
			success: true,
			...result,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error(
			`[${new Date().toISOString()}] Error processing scheduled WhatsApp campaigns:`,
			error,
		);

		return NextResponse.json(
			{
				error: "Internal server error",
				message:
					error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
