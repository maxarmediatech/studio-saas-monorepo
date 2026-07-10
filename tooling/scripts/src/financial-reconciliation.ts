export const MISMATCH_TYPES = [
	"booking_total_vs_active_payments",
	"schedule_total_vs_assigned_active_payments",
	"invoice_paid_status_vs_valid_applications",
	"receipt_payment_amount_mismatch",
	"active_receipt_for_deleted_payment",
	"cross_entity_booking_org_disagreement",
	"multiple_receipts_per_payment",
	"multiple_invoices_per_schedule",
] as const;

export type MismatchType = (typeof MISMATCH_TYPES)[number];

export type SafeFixAction =
	| "recalculate_booking_total"
	| "recalculate_schedule_paid_amount"
	| "recalculate_invoice_paid_status";

export type RawMismatch = {
	organizationId: string;
	mismatchType: MismatchType;
	entityType: string;
	entityId: string;
	relatedId?: string | null;
	relationKey?: string | null;
	actualValue?: string | null;
	expectedValue?: string | null;
	actualStatus?: string | null;
	expectedStatus?: string | null;
	invalidLinkCount?: number | string | null;
	exceedsUpperBound?: boolean | string | null;
	details?: unknown;
};

export type Mismatch = RawMismatch & {
	id: string;
	safeFixAvailable: boolean;
	intendedAction: SafeFixAction | null;
};

export type SafeFixFailure = {
	mismatchId: string;
	reason: "repair_guard_prevented_update" | "repair_transaction_failed";
};

export type SafeFixResult = {
	applied: string[];
	failed: SafeFixFailure[];
};

export type DecisionRecord = {
	decisionDate: string;
	decider: string;
	evidence: string[];
	options: string[];
	rationale: string;
	consequences: string[];
	revisitCondition: string;
	mismatchIds: string[];
	intendedAction: string;
};

const SAFE_ACTIONS: Partial<Record<MismatchType, SafeFixAction>> = {
	booking_total_vs_active_payments: "recalculate_booking_total",
	schedule_total_vs_assigned_active_payments:
		"recalculate_schedule_paid_amount",
	invoice_paid_status_vs_valid_applications:
		"recalculate_invoice_paid_status",
};

function toInteger(value: number | string | null | undefined): number {
	if (value === null || value === undefined) {
		return 0;
	}
	return typeof value === "number" ? value : Number.parseInt(value, 10) || 0;
}

function toBoolean(value: boolean | string | null | undefined): boolean {
	return value === true || value === "true" || value === "t";
}

function encodeIdentityPart(value: string | null | undefined): string {
	if (value === undefined) {
		return "u";
	}
	if (value === null) {
		return "n";
	}
	return `s${value.length}:${value}`;
}

export function isCalendarDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}

	const [year, month, day] = value.split("-").map(Number);
	if (!year || !month || !day) {
		return false;
	}

	const parsed = new Date(`${value}T00:00:00.000Z`);
	return (
		!Number.isNaN(parsed.getTime()) &&
		parsed.getUTCFullYear() === year &&
		parsed.getUTCMonth() + 1 === month &&
		parsed.getUTCDate() === day
	);
}

export function classifyMismatch(raw: RawMismatch): Mismatch {
	const action = SAFE_ACTIONS[raw.mismatchType] ?? null;
	const noInvalidLinks = toInteger(raw.invalidLinkCount) === 0;
	const withinUpperBound = !toBoolean(raw.exceedsUpperBound);
	const isCancelled = raw.actualStatus === "cancelled";
	const draftHasApplication =
		raw.actualStatus === "draft" &&
		raw.expectedStatus !== undefined &&
		raw.expectedStatus !== "draft";
	const safeFixAvailable =
		action !== null &&
		noInvalidLinks &&
		withinUpperBound &&
		!isCancelled &&
		!draftHasApplication;

	return {
		...raw,
		id: [
			raw.mismatchType,
			raw.organizationId,
			raw.entityType,
			raw.entityId,
			raw.relationKey,
			raw.relatedId,
		]
			.map(encodeIdentityPart)
			.join("|"),
		safeFixAvailable,
		intendedAction: safeFixAvailable ? action : null,
	};
}

function compareNullable(
	a: string | null | undefined,
	b: string | null | undefined,
) {
	return (a ?? "").localeCompare(b ?? "");
}

export function sortMismatches(mismatches: Mismatch[]): Mismatch[] {
	return [...mismatches].sort(
		(a, b) =>
			compareNullable(a.organizationId, b.organizationId) ||
			compareNullable(a.mismatchType, b.mismatchType) ||
			compareNullable(a.entityType, b.entityType) ||
			compareNullable(a.entityId, b.entityId) ||
			compareNullable(a.relationKey, b.relationKey) ||
			compareNullable(a.relatedId, b.relatedId),
	);
}

export function validateDecisionRecord(
	value: unknown,
): { valid: true; value: DecisionRecord } | { valid: false; errors: string[] } {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return { valid: false, errors: ["decision record must be an object"] };
	}

	const record = value as Record<string, unknown>;
	const errors: string[] = [];
	const requiredStrings = [
		"decisionDate",
		"decider",
		"rationale",
		"revisitCondition",
		"intendedAction",
	] as const;
	for (const key of requiredStrings) {
		if (typeof record[key] !== "string" || record[key].trim() === "") {
			errors.push(`${key} must be a non-empty string`);
		}
	}
	if (
		typeof record.decisionDate === "string" &&
		record.decisionDate.trim() !== "" &&
		!isCalendarDate(record.decisionDate)
	) {
		errors.push(
			"decisionDate must be a real calendar date in YYYY-MM-DD format",
		);
	}
	for (const key of [
		"evidence",
		"options",
		"consequences",
		"mismatchIds",
	] as const) {
		if (
			!Array.isArray(record[key]) ||
			record[key].some(
				(item) => typeof item !== "string" || item.trim() === "",
			)
		) {
			errors.push(`${key} must be an array of non-empty strings`);
		}
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}
	return { valid: true, value: record as unknown as DecisionRecord };
}

export function summarize(mismatches: Mismatch[]) {
	const byType = Object.fromEntries(
		MISMATCH_TYPES.map((type) => [
			type,
			mismatches.filter((mismatch) => mismatch.mismatchType === type)
				.length,
		]),
	) as Record<MismatchType, number>;

	return {
		actionable: mismatches.length,
		safeFixable: mismatches.filter((mismatch) => mismatch.safeFixAvailable)
			.length,
		manualReview: mismatches.filter(
			(mismatch) => !mismatch.safeFixAvailable,
		).length,
		byType,
	};
}

export async function runIsolatedSafeFixes(
	mismatches: Mismatch[],
	apply: (mismatch: Mismatch) => Promise<boolean>,
): Promise<SafeFixResult> {
	const applied: string[] = [];
	const failed: SafeFixFailure[] = [];

	for (const mismatch of mismatches) {
		try {
			if (await apply(mismatch)) {
				applied.push(mismatch.id);
			} else {
				failed.push({
					mismatchId: mismatch.id,
					reason: "repair_guard_prevented_update",
				});
			}
		} catch {
			failed.push({
				mismatchId: mismatch.id,
				reason: "repair_transaction_failed",
			});
		}
	}

	return { applied, failed };
}
