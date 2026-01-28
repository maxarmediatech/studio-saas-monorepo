import { and, db, inArray, invoices, lt } from "@repo/database";
import { NextResponse } from "next/server";

/**
 * GET /api/cron/invoices/mark-overdue
 *
 * Background job to auto-mark invoices as overdue.
 * Runs daily to update invoices with status 'sent' or 'partial' where dueDate < NOW()
 *
 * Protected by CRON_SECRET environment variable via Authorization header.
 * Returns JSON with count of updated invoices and timestamp for audit trail.
 */
export async function GET(request: Request) {
	// Verify CRON_SECRET from Authorization header
	const authHeader = request.headers.get("authorization");
	const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

	if (authHeader !== expectedAuth) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const now = new Date();
		// Format date as YYYY-MM-DD for comparison with date column (which stores strings)
		const todayStr = now.toISOString().split("T")[0];

		// Update invoices with status 'sent' or 'partial' where dueDate < TODAY
		const result = await db
			.update(invoices)
			.set({ status: "overdue", updatedAt: now })
			.where(
				and(
					inArray(invoices.status, ["sent", "partial"]),
					lt(invoices.dueDate, todayStr),
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
