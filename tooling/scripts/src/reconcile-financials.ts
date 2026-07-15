import { pathToFileURL } from "node:url";
import { db, sql } from "@repo/database";
import type { RawMismatch } from "./financial-reconciliation";
import {
	COLLECTIBLE_INVOICE_STATUSES,
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

const COLLECTIBLE_INVOICE_STATUSES_SQL = sql.raw(
	COLLECTIBLE_INVOICE_STATUSES.map((status) => `'${status}'`).join(", "),
);

function expectedInvoiceStatusSql(input: {
	status: string;
	paidAmount: string;
	totalAmount: string;
	dueDate: string;
	asOf: string;
}) {
	const status = sql.raw(input.status);
	const paidAmount = sql.raw(input.paidAmount);
	const totalAmount = sql.raw(input.totalAmount);
	const dueDate = sql.raw(input.dueDate);
	return sql`CASE
		WHEN ${status} NOT IN (${COLLECTIBLE_INVOICE_STATUSES_SQL}) THEN ${status}
		WHEN ${paidAmount} >= ${totalAmount} THEN 'paid'
		WHEN ${status} = 'overdue' OR (${dueDate} IS NOT NULL AND ${dueDate} < ${input.asOf}) THEN 'overdue'
		WHEN ${paidAmount} > 0 THEN 'partial'
		ELSE 'sent'
	END`;
}

type QueryRow = RawMismatch & {
	actualStatus?: string | null;
	expectedStatus?: string | null;
	invalidLinkCount?: number | string | null;
};

const SAFE_RELATIONSHIP_CTES = sql.raw(`
WITH schedule_chain AS (
	SELECT s.id, s.organization_id, s.booking_id, s.status, s.deleted_at,
		s.deleted_at IS NULL AND s.status <> 'cancelled'
			AND b.id IS NOT NULL
			AND b.organization_id = s.organization_id
			AND b.deleted_at IS NULL AS chain_valid
	FROM payment_schedules s
	LEFT JOIN bookings b ON b.id = s.booking_id
),
invoice_chain AS (
	SELECT i.id, i.organization_id, i.booking_id, i.payment_schedule_id,
		i.status, i.deleted_at,
		i.deleted_at IS NULL AND i.status <> 'cancelled'
			AND b.id IS NOT NULL
			AND b.organization_id = i.organization_id
			AND b.deleted_at IS NULL
			AND (
				i.payment_schedule_id IS NULL OR EXISTS (
					SELECT 1 FROM schedule_chain sc
					WHERE sc.id = i.payment_schedule_id
						AND sc.organization_id = i.organization_id
						AND sc.booking_id = i.booking_id
						AND sc.chain_valid
				)
			) AS chain_valid
	FROM invoices i
	LEFT JOIN bookings b ON b.id = i.booking_id
),
payment_chain AS (
	SELECT p.id, p.organization_id, p.booking_id, p.payment_schedule_id,
		p.invoice_id, p.amount, p.deleted_at,
		(
			(
				p.payment_schedule_id IS NULL OR EXISTS (
					SELECT 1 FROM schedule_chain sc
					WHERE sc.id = p.payment_schedule_id
						AND sc.organization_id = p.organization_id
						AND sc.booking_id = p.booking_id
						AND sc.chain_valid
				)
			)
			AND (
				p.invoice_id IS NULL OR EXISTS (
					SELECT 1 FROM invoice_chain ic
					WHERE ic.id = p.invoice_id
						AND ic.organization_id = p.organization_id
						AND ic.booking_id = p.booking_id
						AND ic.chain_valid
						AND ic.payment_schedule_id IS NOT DISTINCT FROM p.payment_schedule_id
				)
			)
			AND (
				SELECT COUNT(*) FROM receipts r
				WHERE r.received_amount_id = p.id AND r.deleted_at IS NULL
			) <= 1
			AND (
				SELECT COUNT(*) FROM receipts r
				WHERE r.received_amount_id = p.id AND r.deleted_at IS NULL
					AND r.organization_id = p.organization_id
					AND r.booking_id = p.booking_id
					AND r.invoice_id IS NOT DISTINCT FROM p.invoice_id
					AND r.amount = p.amount
				) = (
				SELECT COUNT(*) FROM receipts r
				WHERE r.received_amount_id = p.id AND r.deleted_at IS NULL
			)
			AND (
				p.invoice_id IS NULL OR (
					SELECT COUNT(*) FROM receipts r
					WHERE r.received_amount_id = p.id AND r.deleted_at IS NULL
						AND r.organization_id = p.organization_id
						AND r.booking_id = p.booking_id
						AND r.invoice_id IS NOT DISTINCT FROM p.invoice_id
						AND r.amount = p.amount
				) = 1
			)
		) AS chain_valid
	FROM received_amounts p
)
`);

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
	const expectedInvoiceStatus = expectedInvoiceStatusSql({
		status: "i.status",
		paidAmount: "totals.amount",
		totalAmount: "i.total_amount",
		dueDate: "i.due_date",
		asOf,
	});
	const results = await Promise.all([
		db.execute(sql`${SAFE_RELATIONSHIP_CTES}
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
				COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL AND
					(p.organization_id <> b.organization_id OR NOT p.chain_valid)) AS "invalidLinkCount",
				NOT EXISTS (
					SELECT 1 FROM payment_chain invalid_p
					WHERE invalid_p.booking_id = b.id AND invalid_p.deleted_at IS NULL
						AND (invalid_p.organization_id <> b.organization_id OR NOT invalid_p.chain_valid)
				) AS "safeRepairLinksValid",
				json_build_object(
					'safeRepairLinks', json_build_object(
						'activePaymentInvalidCount', COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL AND
							(p.organization_id <> b.organization_id OR NOT p.chain_valid))
					)
				) AS "details"
			FROM bookings b
			LEFT JOIN payment_chain p ON p.booking_id = b.id
			WHERE b.organization_id = ${organizationId} AND b.deleted_at IS NULL
			GROUP BY b.organization_id, b.id, b.package_cost, b.total_received
			HAVING b.total_received <> COALESCE(SUM(CASE WHEN p.deleted_at IS NULL
				AND p.organization_id = b.organization_id AND p.booking_id = b.id
				THEN p.amount ELSE 0 END), 0)
		`),
		db.execute(sql`${SAFE_RELATIONSHIP_CTES}
			SELECT s.organization_id AS "organizationId",
				'schedule_total_vs_assigned_active_payments' AS "mismatchType",
				'payment_schedule' AS "entityType", s.id AS "entityId",
				s.paid_amount AS "actualValue",
				s.status AS "actualStatus",
				b.id IS NOT NULL AND b.organization_id = s.organization_id
					AND b.deleted_at IS NULL
					AND NOT EXISTS (
						SELECT 1 FROM invoice_chain invalid_i
						WHERE invalid_i.payment_schedule_id = s.id
							AND NOT invalid_i.chain_valid
						)
					AND NOT EXISTS (
						SELECT 1 FROM payment_chain invalid_p
						WHERE invalid_p.payment_schedule_id = s.id
							AND invalid_p.deleted_at IS NULL
							AND (invalid_p.organization_id <> s.organization_id
								OR invalid_p.booking_id <> s.booking_id
								OR NOT invalid_p.chain_valid)
					)
					AS "parentLinksValid",
				b.id IS NOT NULL AND b.organization_id = s.organization_id
					AND b.deleted_at IS NULL
					AND NOT EXISTS (
						SELECT 1 FROM invoice_chain invalid_i
						WHERE invalid_i.payment_schedule_id = s.id
							AND NOT invalid_i.chain_valid
						)
					AND NOT EXISTS (
						SELECT 1 FROM payment_chain invalid_p
						WHERE invalid_p.payment_schedule_id = s.id
							AND invalid_p.deleted_at IS NULL
							AND (invalid_p.organization_id <> s.organization_id
								OR invalid_p.booking_id <> s.booking_id
								OR NOT invalid_p.chain_valid)
					)
					AS "safeRepairLinksValid",
				json_build_object(
					'parentLinks', json_build_object(
						'booking', json_build_object(
							'id', b.id,
							'organizationId', b.organization_id,
							'deletedAt', b.deleted_at,
							'valid', b.id IS NOT NULL
								AND b.organization_id = s.organization_id
								AND b.deleted_at IS NULL
						),
						'invalidLinkedInvoiceCount', (
							SELECT COUNT(*) FROM invoice_chain invalid_i
							WHERE invalid_i.payment_schedule_id = s.id
								AND NOT invalid_i.chain_valid
						)
					)
				) AS "details",
					COALESCE(SUM(CASE WHEN p.deleted_at IS NULL
						AND p.organization_id = s.organization_id AND p.booking_id = s.booking_id
						AND p.payment_schedule_id = s.id THEN p.amount ELSE 0 END), 0)::text AS "expectedValue",
					COALESCE(SUM(CASE WHEN p.deleted_at IS NULL
						AND p.organization_id = s.organization_id AND p.booking_id = s.booking_id
						AND p.payment_schedule_id = s.id THEN p.amount ELSE 0 END), 0) > s.amount AS "exceedsUpperBound",
			COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL AND
				(p.organization_id <> s.organization_id OR p.booking_id <> s.booking_id
				OR NOT p.chain_valid)) AS "invalidLinkCount"
			FROM payment_schedules s
			LEFT JOIN payment_chain p ON p.payment_schedule_id = s.id
			LEFT JOIN bookings b ON b.id = s.booking_id
			WHERE s.organization_id = ${organizationId} AND s.deleted_at IS NULL
				GROUP BY s.organization_id, s.id, s.booking_id, s.amount, s.paid_amount, s.status,
					b.id, b.organization_id, b.deleted_at
			HAVING s.paid_amount <> COALESCE(SUM(CASE WHEN p.deleted_at IS NULL
				AND p.organization_id = s.organization_id AND p.booking_id = s.booking_id
				AND p.payment_schedule_id = s.id THEN p.amount ELSE 0 END), 0)
		`),
		db.execute(sql`${SAFE_RELATIONSHIP_CTES},
			invoice_totals AS (
				SELECT i.id,
					COALESCE((SELECT SUM(p.amount) FROM payment_chain p
						WHERE p.invoice_id = i.id AND p.deleted_at IS NULL
							AND p.organization_id = i.organization_id
							AND p.booking_id = i.booking_id
							AND p.payment_schedule_id IS NOT DISTINCT FROM i.payment_schedule_id
							AND p.chain_valid), 0) AS amount,
					(
						SELECT COUNT(*) FROM payment_chain p
						WHERE p.invoice_id = i.id AND p.deleted_at IS NULL
							AND (
								p.organization_id <> i.organization_id
								OR p.booking_id <> i.booking_id
								OR NOT p.chain_valid
								OR p.payment_schedule_id IS DISTINCT FROM i.payment_schedule_id
							)
					) + (
						SELECT COUNT(*) FROM receipts r
						LEFT JOIN payment_chain p ON p.id = r.received_amount_id
						WHERE r.deleted_at IS NULL
							AND (r.invoice_id = i.id OR p.invoice_id = i.id)
							AND (
								p.id IS NULL OR p.deleted_at IS NOT NULL
								OR r.organization_id <> i.organization_id
								OR r.booking_id <> i.booking_id
								OR r.invoice_id IS DISTINCT FROM i.id
								OR p.organization_id <> i.organization_id
								OR p.booking_id <> i.booking_id
								OR p.invoice_id IS DISTINCT FROM i.id
								OR r.amount <> p.amount
								OR (SELECT COUNT(*) FROM receipts active_receipt
									WHERE active_receipt.received_amount_id = p.id
										AND active_receipt.deleted_at IS NULL) <> 1
							)
					) AS invalid_links
				FROM invoices i
				WHERE i.organization_id = ${organizationId} AND i.deleted_at IS NULL
			)
			SELECT i.organization_id AS "organizationId",
				'invoice_paid_status_vs_valid_applications' AS "mismatchType",
				'invoice' AS "entityType", i.id AS "entityId",
				i.paid_amount AS "actualValue", totals.amount::text AS "expectedValue",
					i.status AS "actualStatus",
				ic.chain_valid AS "parentLinksValid",
				ic.chain_valid AND totals.invalid_links = 0 AS "safeRepairLinksValid",
				json_build_object(
					'parentLinks', json_build_object(
						'booking', json_build_object(
							'id', b.id,
							'organizationId', b.organization_id,
							'deletedAt', b.deleted_at,
							'valid', b.id IS NOT NULL
								AND b.organization_id = i.organization_id
								AND b.deleted_at IS NULL
						),
						'paymentSchedule', CASE WHEN i.payment_schedule_id IS NULL THEN NULL
							ELSE json_build_object(
								'id', s.id,
								'organizationId', s.organization_id,
								'bookingId', s.booking_id,
								'deletedAt', s.deleted_at,
								'valid', s.id IS NOT NULL
									AND s.organization_id = i.organization_id
									AND s.booking_id = i.booking_id
									AND s.deleted_at IS NULL
									AND s.status <> 'cancelled'
									AND sb.id IS NOT NULL
									AND sb.organization_id = s.organization_id
									AND sb.deleted_at IS NULL
							)
						END
						),
						'applicationInvalidCount', totals.invalid_links,
						'collectibleState', i.status IN (${COLLECTIBLE_INVOICE_STATUSES_SQL}),
						'historicalStateInconsistency',
							i.status NOT IN (${COLLECTIBLE_INVOICE_STATUSES_SQL}) AND (
								totals.amount > 0 OR (i.status = 'paid' AND totals.amount < i.total_amount)
							)
					) AS "details",
				totals.amount > i.total_amount AS "exceedsUpperBound",
				${expectedInvoiceStatus} AS "expectedStatus",
				totals.invalid_links AS "invalidLinkCount"
			FROM invoices i
			JOIN invoice_totals totals ON totals.id = i.id
			JOIN invoice_chain ic ON ic.id = i.id
			LEFT JOIN bookings b ON b.id = i.booking_id
			LEFT JOIN payment_schedules s ON s.id = i.payment_schedule_id
			LEFT JOIN bookings sb ON sb.id = s.booking_id
			WHERE i.organization_id = ${organizationId} AND i.deleted_at IS NULL
				AND (
					i.paid_amount <> totals.amount
					OR i.status <> ${expectedInvoiceStatus}
					OR (i.status NOT IN (${COLLECTIBLE_INVOICE_STATUSES_SQL}) AND (
						totals.amount > 0 OR (i.status = 'paid' AND totals.amount < i.total_amount)
					))
				)
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
		db.execute(sql`${SAFE_RELATIONSHIP_CTES}
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
				SELECT p.organization_id, 'cross_entity_booking_org_disagreement', 'received_amount', p.id,
					p.invoice_id,
					'received_amount.invoice_payment_schedule',
					json_build_object('relation', 'invoice_payment_schedule',
						'defect', 'schedule_identity_disagreement',
						'paymentScheduleId', p.payment_schedule_id,
						'invoiceScheduleId', i.payment_schedule_id)
				FROM payment_chain p JOIN invoices i ON i.id = p.invoice_id
				WHERE p.organization_id = ${organizationId} AND p.deleted_at IS NULL
					AND p.payment_schedule_id IS DISTINCT FROM i.payment_schedule_id
				UNION ALL
				SELECT p.organization_id, 'cross_entity_booking_org_disagreement', 'received_amount', p.id,
					p.payment_schedule_id,
					'received_amount.payment_schedule.cancelled',
					json_build_object('relation', 'payment_schedule', 'defect', 'cancelled',
						'paymentScheduleId', p.payment_schedule_id, 'status', s.status)
				FROM payment_chain p JOIN payment_schedules s ON s.id = p.payment_schedule_id
				WHERE p.organization_id = ${organizationId} AND p.deleted_at IS NULL
					AND s.status = 'cancelled'
				UNION ALL
				SELECT p.organization_id, 'cross_entity_booking_org_disagreement', 'received_amount', p.id,
					p.invoice_id,
					'received_amount.invoice.cancelled',
					json_build_object('relation', 'invoice', 'defect', 'cancelled',
						'invoiceId', p.invoice_id, 'status', i.status)
				FROM payment_chain p JOIN invoices i ON i.id = p.invoice_id
				WHERE p.organization_id = ${organizationId} AND p.deleted_at IS NULL
					AND i.status = 'cancelled'
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
			SELECT i.organization_id, 'cross_entity_booking_org_disagreement', 'invoice', i.id,
				i.payment_schedule_id,
				'invoice.payment_schedule.cancelled',
				json_build_object('relation', 'payment_schedule', 'defect', 'cancelled',
					'paymentScheduleId', i.payment_schedule_id, 'status', s.status)
			FROM invoices i JOIN payment_schedules s ON s.id = i.payment_schedule_id
			WHERE i.organization_id = ${organizationId} AND i.deleted_at IS NULL
				AND s.status = 'cancelled'
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
	const expectedInvoiceStatus = expectedInvoiceStatusSql({
		status: "i.status",
		paidAmount: "invoice_totals.amount",
		totalAmount: "i.total_amount",
		dueDate: "i.due_date",
		asOf,
	});
	const safe = mismatches.filter((mismatch) => mismatch.safeFixAvailable);
	return runIsolatedSafeFixes(safe, async (mismatch) =>
		db.transaction(async (tx) => {
			let updated = false;
			if (mismatch.intendedAction === "recalculate_booking_total") {
				const result = await tx.execute(sql`${SAFE_RELATIONSHIP_CTES}
						UPDATE bookings b SET total_received = COALESCE((
							SELECT SUM(p.amount) FROM payment_chain p
						WHERE p.organization_id = b.organization_id AND p.booking_id = b.id AND p.deleted_at IS NULL
					), 0), updated_at = NOW()
					WHERE b.id = ${mismatch.entityId} AND b.organization_id = ${organizationId} AND b.deleted_at IS NULL
      AND COALESCE((SELECT SUM(p.amount) FROM payment_chain p
						WHERE p.organization_id = b.organization_id AND p.booking_id = b.id AND p.deleted_at IS NULL), 0) <= b.package_cost
						AND NOT EXISTS (SELECT 1 FROM payment_chain p WHERE p.booking_id = b.id
							AND p.deleted_at IS NULL
							AND (p.organization_id <> b.organization_id OR NOT p.chain_valid))
					RETURNING b.id
				`);
				updated = result.rows.length > 0;
			} else if (
				mismatch.intendedAction === "recalculate_schedule_paid_amount"
			) {
				const result = await tx.execute(sql`${SAFE_RELATIONSHIP_CTES}
						UPDATE payment_schedules s SET paid_amount = COALESCE((
							SELECT SUM(p.amount) FROM payment_chain p
						WHERE p.organization_id = s.organization_id AND p.booking_id = s.booking_id
						AND p.payment_schedule_id = s.id AND p.deleted_at IS NULL
					), 0), updated_at = NOW()
						WHERE s.id = ${mismatch.entityId} AND s.organization_id = ${organizationId}
						AND s.deleted_at IS NULL AND s.status <> 'cancelled'
						AND EXISTS (SELECT 1 FROM bookings parent_booking
							WHERE parent_booking.id = s.booking_id
							AND parent_booking.organization_id = s.organization_id
							AND parent_booking.deleted_at IS NULL)
						AND EXISTS (SELECT 1 FROM schedule_chain sc
							WHERE sc.id = s.id AND sc.chain_valid)
						AND COALESCE((SELECT SUM(p.amount) FROM payment_chain p
							WHERE p.organization_id = s.organization_id AND p.booking_id = s.booking_id
								AND p.payment_schedule_id = s.id AND p.deleted_at IS NULL), 0) <= s.amount
						AND NOT EXISTS (SELECT 1 FROM payment_chain p WHERE p.payment_schedule_id = s.id
						AND p.deleted_at IS NULL
						AND (p.organization_id <> s.organization_id OR p.booking_id <> s.booking_id
							OR NOT p.chain_valid))
						AND NOT EXISTS (SELECT 1 FROM invoice_chain i
							WHERE i.payment_schedule_id = s.id AND NOT i.chain_valid)
					RETURNING s.id
				`);
				updated = result.rows.length > 0;
			} else if (
				mismatch.intendedAction === "recalculate_invoice_paid_status"
			) {
				const result = await tx.execute(sql`${SAFE_RELATIONSHIP_CTES},
						invoice_totals AS (
							SELECT i.id,
								COALESCE((SELECT SUM(p.amount) FROM payment_chain p
									WHERE p.invoice_id = i.id AND p.deleted_at IS NULL
										AND p.organization_id = i.organization_id
										AND p.booking_id = i.booking_id
									AND p.payment_schedule_id IS NOT DISTINCT FROM i.payment_schedule_id
										AND p.chain_valid), 0) AS amount,
								(
									SELECT COUNT(*) FROM payment_chain p
									WHERE p.invoice_id = i.id AND p.deleted_at IS NULL
										AND (
											p.organization_id <> i.organization_id
											OR p.booking_id <> i.booking_id
											OR NOT p.chain_valid
									OR p.payment_schedule_id IS DISTINCT FROM i.payment_schedule_id
										)
								) + (
									SELECT COUNT(*) FROM receipts r
									LEFT JOIN payment_chain p ON p.id = r.received_amount_id
									WHERE r.deleted_at IS NULL
										AND (r.invoice_id = i.id OR p.invoice_id = i.id)
										AND (
											p.id IS NULL OR p.deleted_at IS NOT NULL
											OR r.organization_id <> i.organization_id
											OR r.booking_id <> i.booking_id
											OR r.invoice_id IS DISTINCT FROM i.id
											OR p.organization_id <> i.organization_id
											OR p.booking_id <> i.booking_id
											OR p.invoice_id IS DISTINCT FROM i.id
											OR r.amount <> p.amount
											OR (SELECT COUNT(*) FROM receipts active_receipt
												WHERE active_receipt.received_amount_id = p.id
													AND active_receipt.deleted_at IS NULL) <> 1
										)
								) AS invalid_links
							FROM invoices i
							WHERE i.id = ${mismatch.entityId} AND i.organization_id = ${organizationId}
								AND i.deleted_at IS NULL
						)
						UPDATE invoices i SET paid_amount = invoice_totals.amount,
							status = ${expectedInvoiceStatus},
							updated_at = NOW()
						FROM invoice_totals
						WHERE i.id = invoice_totals.id AND invoice_totals.invalid_links = 0
							AND invoice_totals.amount <= i.total_amount
							AND i.status IN (${COLLECTIBLE_INVOICE_STATUSES_SQL})
							AND EXISTS (SELECT 1 FROM invoice_chain ic
								WHERE ic.id = i.id AND ic.chain_valid)
							AND EXISTS (SELECT 1 FROM bookings parent_booking
								WHERE parent_booking.id = i.booking_id
								AND parent_booking.organization_id = i.organization_id
								AND parent_booking.deleted_at IS NULL)
							AND (i.payment_schedule_id IS NULL OR EXISTS (
								SELECT 1 FROM payment_schedules parent_schedule
								JOIN bookings parent_schedule_booking
									ON parent_schedule_booking.id = parent_schedule.booking_id
								WHERE parent_schedule.id = i.payment_schedule_id
								AND parent_schedule.organization_id = i.organization_id
									AND parent_schedule.booking_id = i.booking_id
									AND parent_schedule.deleted_at IS NULL
									AND parent_schedule.status <> 'cancelled'
								AND parent_schedule_booking.organization_id = parent_schedule.organization_id
								AND parent_schedule_booking.deleted_at IS NULL
							))
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
