import { pathToFileURL } from "node:url";
import { db, sql } from "@repo/database";
import type { RawMismatch } from "./financial-reconciliation";
import {
	classifyMismatch,
	MISMATCH_TYPES,
	runIsolatedSafeFixes,
	sortMismatches,
	summarize,
} from "./financial-reconciliation";
import {
	parseReconciliationArguments,
	resultRows,
} from "./financial-reconciliation-command";

type QueryRow = RawMismatch & {
	actualStatus?: string | null;
	expectedStatus?: string | null;
	invalidLinkCount?: number | string | null;
};

export type FinancialReconciliationReport = {
	reportVersion: 1;
	organizationId: string;
	asOf: string;
	mismatchTypes: typeof MISMATCH_TYPES;
	summary: ReturnType<typeof summarize>;
	mismatches: ReturnType<typeof classifyMismatch>[];
};

export async function queryFinancialMismatches(
	organizationId: string,
	asOf: string,
) {
	const results = await Promise.all([
		db.execute(sql`
			SELECT b.organization_id AS "organizationId",
				'booking_total_vs_active_payments' AS "mismatchType",
				'booking' AS "entityType", b.id AS "entityId",
				b.total_received AS "actualValue",
				COALESCE(SUM(CASE WHEN p.deleted_at IS NULL
					AND p.organization_id = b.organization_id AND p.booking_id = b.id
					THEN p.amount ELSE 0 END), 0)::text AS "expectedValue",
				COALESCE(SUM(CASE WHEN p.deleted_at IS NULL
					AND p.organization_id = b.organization_id AND p.booking_id = b.id
					THEN p.amount ELSE 0 END), 0) > b.package_cost AS "exceedsUpperBound",
				COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL
					AND (p.organization_id <> b.organization_id OR p.booking_id <> b.id)) AS "invalidLinkCount"
			FROM bookings b
			LEFT JOIN received_amounts p ON p.booking_id = b.id
			WHERE b.organization_id = ${organizationId} AND b.deleted_at IS NULL
			GROUP BY b.organization_id, b.id, b.package_cost, b.total_received
			HAVING b.total_received <> COALESCE(SUM(CASE WHEN p.deleted_at IS NULL
				AND p.organization_id = b.organization_id AND p.booking_id = b.id
				THEN p.amount ELSE 0 END), 0)
		`),
		db.execute(sql`
			SELECT s.organization_id AS "organizationId",
				'schedule_total_vs_assigned_active_payments' AS "mismatchType",
				'payment_schedule' AS "entityType", s.id AS "entityId",
				s.paid_amount AS "actualValue",
				s.status AS "actualStatus",
					COALESCE(SUM(CASE WHEN p.deleted_at IS NULL
						AND p.organization_id = s.organization_id AND p.booking_id = s.booking_id
						AND p.payment_schedule_id = s.id THEN p.amount ELSE 0 END), 0)::text AS "expectedValue",
					COALESCE(SUM(CASE WHEN p.deleted_at IS NULL
						AND p.organization_id = s.organization_id AND p.booking_id = s.booking_id
						AND p.payment_schedule_id = s.id THEN p.amount ELSE 0 END), 0) > s.amount AS "exceedsUpperBound",
				COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL
					AND (p.organization_id <> s.organization_id OR p.booking_id <> s.booking_id
					OR p.payment_schedule_id <> s.id)) AS "invalidLinkCount"
			FROM payment_schedules s
			LEFT JOIN received_amounts p ON p.payment_schedule_id = s.id
			WHERE s.organization_id = ${organizationId} AND s.deleted_at IS NULL
			GROUP BY s.organization_id, s.id, s.booking_id, s.amount, s.paid_amount, s.status
			HAVING s.paid_amount <> COALESCE(SUM(CASE WHEN p.deleted_at IS NULL
				AND p.organization_id = s.organization_id AND p.booking_id = s.booking_id
				AND p.payment_schedule_id = s.id THEN p.amount ELSE 0 END), 0)
		`),
		db.execute(sql`
			WITH paid AS (
				SELECT i.id,
					(SELECT COALESCE(SUM(r.amount), 0)
						FROM receipts r JOIN received_amounts p ON p.id = r.received_amount_id
						WHERE r.deleted_at IS NULL AND p.deleted_at IS NULL
							AND r.invoice_id = i.id AND p.invoice_id = i.id
							AND r.organization_id = i.organization_id
							AND p.organization_id = i.organization_id
							AND r.booking_id = i.booking_id AND p.booking_id = i.booking_id
							AND r.amount = p.amount
							AND 1 = (SELECT COUNT(*) FROM receipts active_receipt
								WHERE active_receipt.organization_id = r.organization_id
									AND active_receipt.received_amount_id = r.received_amount_id
									AND active_receipt.deleted_at IS NULL)) AS amount,
					((SELECT COUNT(*) FROM received_amounts p
						WHERE p.invoice_id = i.id AND p.deleted_at IS NULL
							AND (p.organization_id <> i.organization_id
								OR p.booking_id <> i.booking_id
								OR 1 <> (SELECT COUNT(*) FROM receipts active_receipt
									WHERE active_receipt.received_amount_id = p.id
										AND active_receipt.deleted_at IS NULL)
								OR NOT EXISTS (SELECT 1 FROM receipts valid_receipt
									WHERE valid_receipt.received_amount_id = p.id
										AND valid_receipt.deleted_at IS NULL
										AND valid_receipt.organization_id = i.organization_id
										AND valid_receipt.booking_id = i.booking_id
										AND valid_receipt.invoice_id = i.id
										AND valid_receipt.amount = p.amount))) +
					(SELECT COUNT(*) FROM receipts r
						LEFT JOIN received_amounts p ON p.id = r.received_amount_id
						WHERE r.deleted_at IS NULL AND (r.invoice_id = i.id OR p.invoice_id = i.id)
							AND (p.id IS NULL OR p.deleted_at IS NOT NULL
								OR r.organization_id <> i.organization_id
								OR p.organization_id <> i.organization_id
								OR r.booking_id <> i.booking_id OR p.booking_id <> i.booking_id
								OR r.invoice_id IS DISTINCT FROM p.invoice_id
								OR r.amount <> p.amount
								OR 1 <> (SELECT COUNT(*) FROM receipts active_receipt
									WHERE active_receipt.received_amount_id = r.received_amount_id
										AND active_receipt.deleted_at IS NULL)))) AS invalid_links
				FROM invoices i
				WHERE i.organization_id = ${organizationId} AND i.deleted_at IS NULL
			)
			SELECT i.organization_id AS "organizationId",
				'invoice_paid_status_vs_valid_applications' AS "mismatchType",
				'invoice' AS "entityType", i.id AS "entityId",
				i.paid_amount AS "actualValue", paid.amount::text AS "expectedValue",
					i.status AS "actualStatus",
					paid.amount > i.total_amount AS "exceedsUpperBound",
				CASE WHEN paid.amount >= i.total_amount THEN 'paid'
					WHEN i.status = 'overdue' OR (i.due_date IS NOT NULL AND i.due_date < ${asOf}) THEN 'overdue'
					WHEN paid.amount > 0 THEN 'partial'
					WHEN i.status IN ('paid', 'partial') THEN 'sent' ELSE i.status END AS "expectedStatus",
				paid.invalid_links AS "invalidLinkCount"
			FROM invoices i JOIN paid ON paid.id = i.id
			WHERE i.organization_id = ${organizationId} AND i.deleted_at IS NULL
				AND (i.paid_amount <> paid.amount OR i.status <> CASE
					WHEN paid.amount >= i.total_amount THEN 'paid'
					WHEN i.status = 'overdue' OR (i.due_date IS NOT NULL AND i.due_date < ${asOf}) THEN 'overdue'
					WHEN paid.amount > 0 THEN 'partial'
					WHEN i.status IN ('paid', 'partial') THEN 'sent' ELSE i.status END)
		`),
		db.execute(sql`
			SELECT r.organization_id AS "organizationId",
				'receipt_payment_amount_mismatch' AS "mismatchType",
				'receipt' AS "entityType", r.id AS "entityId",
				r.received_amount_id AS "relatedId", r.amount AS "actualValue", p.amount AS "expectedValue"
			FROM receipts r JOIN received_amounts p ON p.id = r.received_amount_id
			WHERE r.organization_id = ${organizationId} AND r.deleted_at IS NULL
				AND p.deleted_at IS NULL AND p.organization_id = r.organization_id AND r.amount <> p.amount
		`),
		db.execute(sql`
			SELECT r.organization_id AS "organizationId",
				'active_receipt_for_deleted_payment' AS "mismatchType",
				'receipt' AS "entityType", r.id AS "entityId",
				r.received_amount_id AS "relatedId",
				json_build_object('paymentExists', p.id IS NOT NULL, 'paymentDeleted', p.deleted_at IS NOT NULL) AS "details"
			FROM receipts r LEFT JOIN received_amounts p ON p.id = r.received_amount_id
			WHERE r.organization_id = ${organizationId} AND r.deleted_at IS NULL
				AND r.received_amount_id IS NOT NULL AND (p.id IS NULL OR p.deleted_at IS NOT NULL)
		`),
		db.execute(sql`
				SELECT p.organization_id AS "organizationId",
					'multiple_receipts_per_payment' AS "mismatchType",
					'received_amount' AS "entityType", p.id AS "entityId",
					COUNT(*)::text AS "actualValue",
					json_build_object(
						'allReceipts', json_agg(json_build_object(
							'id', r.id, 'organizationId', r.organization_id, 'deletedAt', r.deleted_at
						) ORDER BY r.id),
						'activeReceiptIds', COALESCE(json_agg(r.id ORDER BY r.id) FILTER (WHERE r.deleted_at IS NULL), '[]'::json),
						'activeCount', COUNT(*) FILTER (WHERE r.deleted_at IS NULL)
					) AS "details"
				FROM received_amounts p
				INNER JOIN receipts r ON r.received_amount_id = p.id
				WHERE p.organization_id = ${organizationId}
				GROUP BY p.organization_id, p.id
				HAVING COUNT(*) > 1
			`),
		db.execute(sql`
				SELECT s.organization_id AS "organizationId",
					'multiple_invoices_per_schedule' AS "mismatchType",
					'payment_schedule' AS "entityType", s.id AS "entityId",
					COUNT(*)::text AS "actualValue",
					json_build_object(
						'allInvoices', json_agg(json_build_object(
							'id', i.id, 'organizationId', i.organization_id, 'deletedAt', i.deleted_at
						) ORDER BY i.id),
						'activeInvoiceIds', COALESCE(json_agg(i.id ORDER BY i.id) FILTER (WHERE i.deleted_at IS NULL), '[]'::json),
						'activeCount', COUNT(*) FILTER (WHERE i.deleted_at IS NULL)
					) AS "details"
				FROM payment_schedules s
				INNER JOIN invoices i ON i.payment_schedule_id = s.id
				WHERE s.organization_id = ${organizationId}
				GROUP BY s.organization_id, s.id
			HAVING COUNT(*) > 1
		`),
		db.execute(sql`
			SELECT p.organization_id AS "organizationId",
				'cross_entity_booking_org_disagreement' AS "mismatchType",
				'received_amount' AS "entityType", p.id AS "entityId",
				p.booking_id AS "relatedId",
				'received_amount.booking' AS "relationKey",
				json_build_object('relation', 'booking', 'relatedOrganizationId', b.organization_id,
					'relatedBookingId', b.id) AS "details"
			FROM received_amounts p LEFT JOIN bookings b ON b.id = p.booking_id
			WHERE p.organization_id = ${organizationId} AND p.deleted_at IS NULL
				AND (b.id IS NULL OR b.organization_id <> p.organization_id OR b.deleted_at IS NOT NULL)
			UNION ALL
			SELECT p.organization_id, 'cross_entity_booking_org_disagreement', 'received_amount', p.id,
				p.payment_schedule_id,
				'received_amount.payment_schedule',
				json_build_object('relation', 'payment_schedule', 'relatedOrganizationId', s.organization_id,
					'relatedBookingId', s.booking_id)
			FROM received_amounts p LEFT JOIN payment_schedules s ON s.id = p.payment_schedule_id
			WHERE p.organization_id = ${organizationId} AND p.deleted_at IS NULL AND p.payment_schedule_id IS NOT NULL
				AND (s.id IS NULL OR s.organization_id <> p.organization_id OR s.booking_id <> p.booking_id OR s.deleted_at IS NOT NULL)
			UNION ALL
			SELECT p.organization_id, 'cross_entity_booking_org_disagreement', 'received_amount', p.id,
				p.invoice_id,
				'received_amount.invoice',
				json_build_object('relation', 'invoice', 'relatedOrganizationId', i.organization_id,
					'relatedBookingId', i.booking_id)
			FROM received_amounts p LEFT JOIN invoices i ON i.id = p.invoice_id
				WHERE p.organization_id = ${organizationId} AND p.deleted_at IS NULL AND p.invoice_id IS NOT NULL
					AND (i.id IS NULL OR i.organization_id <> p.organization_id OR i.booking_id <> p.booking_id OR i.deleted_at IS NOT NULL)
				UNION ALL
				SELECT p.organization_id, 'cross_entity_booking_org_disagreement', 'received_amount', p.id,
					p.invoice_id,
					'received_amount.invoice_receipt',
					json_build_object('relation', 'invoice_application_receipt',
						'paymentInvoiceId', p.invoice_id, 'activeValidReceiptCount', 0)
				FROM received_amounts p
				WHERE p.organization_id = ${organizationId} AND p.deleted_at IS NULL AND p.invoice_id IS NOT NULL
					AND NOT EXISTS (SELECT 1 FROM receipts r
						WHERE r.received_amount_id = p.id AND r.deleted_at IS NULL
							AND r.organization_id = p.organization_id
							AND r.booking_id = p.booking_id AND r.invoice_id = p.invoice_id
							AND r.amount = p.amount)
				UNION ALL
				SELECT s.organization_id, 'cross_entity_booking_org_disagreement', 'payment_schedule', s.id,
				s.booking_id,
				'payment_schedule.booking',
				json_build_object('relation', 'booking', 'relatedOrganizationId', b.organization_id,
					'relatedBookingId', b.id)
			FROM payment_schedules s LEFT JOIN bookings b ON b.id = s.booking_id
			WHERE s.organization_id = ${organizationId} AND s.deleted_at IS NULL
				AND (b.id IS NULL OR b.organization_id <> s.organization_id OR b.deleted_at IS NOT NULL)
			UNION ALL
			SELECT i.organization_id, 'cross_entity_booking_org_disagreement', 'invoice', i.id,
				i.booking_id,
				'invoice.booking',
				json_build_object('relation', 'booking', 'relatedOrganizationId', b.organization_id,
					'relatedBookingId', b.id)
			FROM invoices i LEFT JOIN bookings b ON b.id = i.booking_id
			WHERE i.organization_id = ${organizationId} AND i.deleted_at IS NULL
				AND (b.id IS NULL OR b.organization_id <> i.organization_id OR b.deleted_at IS NOT NULL)
			UNION ALL
			SELECT i.organization_id, 'cross_entity_booking_org_disagreement', 'invoice', i.id,
				i.payment_schedule_id,
				'invoice.payment_schedule',
				json_build_object('relation', 'payment_schedule', 'relatedOrganizationId', s.organization_id,
					'relatedBookingId', s.booking_id)
			FROM invoices i LEFT JOIN payment_schedules s ON s.id = i.payment_schedule_id
			WHERE i.organization_id = ${organizationId} AND i.deleted_at IS NULL AND i.payment_schedule_id IS NOT NULL
				AND (s.id IS NULL OR s.organization_id <> i.organization_id OR s.booking_id <> i.booking_id OR s.deleted_at IS NOT NULL)
			UNION ALL
			SELECT r.organization_id, 'cross_entity_booking_org_disagreement', 'receipt', r.id,
				r.booking_id,
				'receipt.booking',
				json_build_object('relation', 'booking', 'relatedOrganizationId', b.organization_id,
					'relatedBookingId', b.id)
			FROM receipts r LEFT JOIN bookings b ON b.id = r.booking_id
			WHERE r.organization_id = ${organizationId} AND r.deleted_at IS NULL
				AND (b.id IS NULL OR b.organization_id <> r.organization_id OR b.deleted_at IS NOT NULL)
			UNION ALL
			SELECT r.organization_id, 'cross_entity_booking_org_disagreement', 'receipt', r.id,
				r.invoice_id,
				'receipt.invoice',
				json_build_object('relation', 'invoice', 'relatedOrganizationId', i.organization_id,
					'relatedBookingId', i.booking_id)
			FROM receipts r LEFT JOIN invoices i ON i.id = r.invoice_id
			WHERE r.organization_id = ${organizationId} AND r.deleted_at IS NULL AND r.invoice_id IS NOT NULL
				AND (i.id IS NULL OR i.organization_id <> r.organization_id OR i.booking_id <> r.booking_id OR i.deleted_at IS NOT NULL)
			UNION ALL
				SELECT r.organization_id, 'cross_entity_booking_org_disagreement', 'receipt', r.id,
					r.received_amount_id,
					'receipt.received_amount',
					json_build_object('relation', 'received_amount', 'relatedOrganizationId', p.organization_id,
						'relatedBookingId', p.booking_id, 'receiptInvoiceId', r.invoice_id,
						'paymentInvoiceId', p.invoice_id)
				FROM receipts r LEFT JOIN received_amounts p ON p.id = r.received_amount_id
				WHERE r.organization_id = ${organizationId} AND r.deleted_at IS NULL AND r.received_amount_id IS NOT NULL
					AND (p.id IS NULL OR p.organization_id <> r.organization_id OR p.booking_id <> r.booking_id
						OR r.invoice_id IS DISTINCT FROM p.invoice_id)
		`),
	]);

	const raw = results.flatMap((result) => resultRows<QueryRow>(result));
	const mismatches = sortMismatches(raw.map(classifyMismatch));
	return {
		reportVersion: 1 as const,
		organizationId,
		asOf,
		mismatchTypes: MISMATCH_TYPES,
		summary: summarize(mismatches),
		mismatches,
	} satisfies FinancialReconciliationReport;
}

export async function applySafeFinancialFixes(
	organizationId: string,
	asOf: string,
	mismatches: FinancialReconciliationReport["mismatches"],
) {
	const safe = mismatches.filter((mismatch) => mismatch.safeFixAvailable);
	return runIsolatedSafeFixes(safe, async (mismatch) =>
		db.transaction(async (tx) => {
			let updated = false;
			if (mismatch.intendedAction === "recalculate_booking_total") {
				const result = await tx.execute(sql`
					UPDATE bookings b SET total_received = COALESCE((
						SELECT SUM(p.amount) FROM received_amounts p
						WHERE p.organization_id = b.organization_id AND p.booking_id = b.id AND p.deleted_at IS NULL
					), 0), updated_at = NOW()
					WHERE b.id = ${mismatch.entityId} AND b.organization_id = ${organizationId} AND b.deleted_at IS NULL
					AND COALESCE((SELECT SUM(p.amount) FROM received_amounts p
						WHERE p.organization_id = b.organization_id AND p.booking_id = b.id AND p.deleted_at IS NULL), 0) <= b.package_cost
					AND NOT EXISTS (SELECT 1 FROM received_amounts p WHERE p.booking_id = b.id
						AND p.deleted_at IS NULL AND (p.organization_id <> b.organization_id OR p.booking_id <> b.id))
					RETURNING b.id
				`);
				updated = result.rows.length > 0;
			} else if (
				mismatch.intendedAction === "recalculate_schedule_paid_amount"
			) {
				const result = await tx.execute(sql`
					UPDATE payment_schedules s SET paid_amount = COALESCE((
						SELECT SUM(p.amount) FROM received_amounts p
						WHERE p.organization_id = s.organization_id AND p.booking_id = s.booking_id
						AND p.payment_schedule_id = s.id AND p.deleted_at IS NULL
					), 0), updated_at = NOW()
						WHERE s.id = ${mismatch.entityId} AND s.organization_id = ${organizationId}
						AND s.deleted_at IS NULL AND s.status <> 'cancelled'
						AND COALESCE((SELECT SUM(p.amount) FROM received_amounts p
							WHERE p.organization_id = s.organization_id AND p.booking_id = s.booking_id
								AND p.payment_schedule_id = s.id AND p.deleted_at IS NULL), 0) <= s.amount
						AND NOT EXISTS (SELECT 1 FROM received_amounts p WHERE p.payment_schedule_id = s.id
						AND p.deleted_at IS NULL AND (p.organization_id <> s.organization_id OR p.booking_id <> s.booking_id))
					RETURNING s.id
				`);
				updated = result.rows.length > 0;
			} else if (
				mismatch.intendedAction === "recalculate_invoice_paid_status"
			) {
				const result = await tx.execute(sql`
						WITH totals AS (
							SELECT i.id,
								(SELECT COALESCE(SUM(r.amount), 0)
									FROM receipts r JOIN received_amounts p ON p.id = r.received_amount_id
									WHERE r.deleted_at IS NULL AND p.deleted_at IS NULL
										AND r.invoice_id = i.id AND p.invoice_id = i.id
										AND r.organization_id = i.organization_id
										AND p.organization_id = i.organization_id
										AND r.booking_id = i.booking_id AND p.booking_id = i.booking_id
										AND r.amount = p.amount
										AND 1 = (SELECT COUNT(*) FROM receipts active_receipt
											WHERE active_receipt.organization_id = r.organization_id
												AND active_receipt.received_amount_id = r.received_amount_id
												AND active_receipt.deleted_at IS NULL)) AS amount,
								((SELECT COUNT(*) FROM received_amounts p
									WHERE p.invoice_id = i.id AND p.deleted_at IS NULL
										AND (p.organization_id <> i.organization_id
											OR p.booking_id <> i.booking_id
											OR 1 <> (SELECT COUNT(*) FROM receipts active_receipt
												WHERE active_receipt.received_amount_id = p.id
													AND active_receipt.deleted_at IS NULL)
											OR NOT EXISTS (SELECT 1 FROM receipts valid_receipt
												WHERE valid_receipt.received_amount_id = p.id
													AND valid_receipt.deleted_at IS NULL
													AND valid_receipt.organization_id = i.organization_id
													AND valid_receipt.booking_id = i.booking_id
													AND valid_receipt.invoice_id = i.id
													AND valid_receipt.amount = p.amount))) +
								(SELECT COUNT(*) FROM receipts r
									LEFT JOIN received_amounts p ON p.id = r.received_amount_id
									WHERE r.deleted_at IS NULL AND (r.invoice_id = i.id OR p.invoice_id = i.id)
										AND (p.id IS NULL OR p.deleted_at IS NOT NULL
											OR r.organization_id <> i.organization_id
											OR p.organization_id <> i.organization_id
											OR r.booking_id <> i.booking_id OR p.booking_id <> i.booking_id
											OR r.invoice_id IS DISTINCT FROM p.invoice_id
											OR r.amount <> p.amount
											OR 1 <> (SELECT COUNT(*) FROM receipts active_receipt
												WHERE active_receipt.received_amount_id = r.received_amount_id
													AND active_receipt.deleted_at IS NULL)))) AS invalid_links
							FROM invoices i
							WHERE i.id = ${mismatch.entityId} AND i.organization_id = ${organizationId}
								AND i.deleted_at IS NULL AND i.status <> 'cancelled'
						)
						UPDATE invoices i SET paid_amount = totals.amount,
							status = CASE WHEN totals.amount >= i.total_amount THEN 'paid'
								WHEN i.status = 'overdue' OR (i.due_date IS NOT NULL AND i.due_date < ${asOf}) THEN 'overdue'
								WHEN totals.amount > 0 THEN 'partial'
								WHEN i.status IN ('paid', 'partial') THEN 'sent' ELSE i.status END,
							updated_at = NOW()
						FROM totals
						WHERE i.id = totals.id AND totals.invalid_links = 0
							AND totals.amount <= i.total_amount
						RETURNING i.id
					`);
				updated = result.rows.length > 0;
			}
			return updated;
		}),
	);
}

export async function main(argv = process.argv.slice(2)) {
	const { mode, organizationId, asOf } = parseReconciliationArguments(argv);
	const before = await queryFinancialMismatches(organizationId, asOf);

	if (mode === "report") {
		console.log(JSON.stringify({ mode, ...before }));
		return before.mismatches.length > 0 ? 1 : 0;
	}

	const repairResult = await applySafeFinancialFixes(
		organizationId,
		asOf,
		before.mismatches,
	);
	const after = await queryFinancialMismatches(organizationId, asOf);
	console.log(
		JSON.stringify({
			mode,
			before,
			applied: repairResult.applied,
			failed: repairResult.failed,
			after,
		}),
	);
	return after.mismatches.length > 0 ? 1 : 0;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	main()
		.then((exitCode) => {
			process.exitCode = exitCode;
		})
		.catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : error);
			process.exitCode = 2;
		});
}
