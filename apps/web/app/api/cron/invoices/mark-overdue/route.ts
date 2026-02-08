import { timingSafeEqual } from "node:crypto";
import { and, db, inArray, invoices, isNull, lt, sql } from "@repo/database";
import { NextResponse } from "next/server";

function secureCompare(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
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
		const now = new Date();

		const result = await db
			.update(invoices)
			.set({ status: "overdue", updatedAt: now })
			.where(
				and(
					inArray(invoices.status, ["sent", "partial"]),
					lt(invoices.dueDate, sql`CURRENT_DATE`),
					isNull(invoices.deletedAt),
					isNull(invoices.paidAt),
				),
			)
			.returning({ id: invoices.id });

		// Log execution for audit trail
		console.log(
			`[${now.toISOString()}] Marked ${result.length} invoices as overdue`,
		);

		return NextResponse.json({
			success: true,
			updatedCount: result.length,
			timestamp: now.toISOString(),
		});
	} catch (error) {
		console.error(
			`[${new Date().toISOString()}] Error marking invoices as overdue:`,
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
