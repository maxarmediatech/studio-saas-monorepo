export const MISMATCH_TYPES = [
	"booking_total_vs_active_payments",
	"schedule_total_vs_assigned_active_payments",
	"invoice_paid_status_vs_valid_applications",
	"receipt_payment_amount_mismatch",
	"active_receipt_for_deleted_payment",
	"cross_entity_booking_org_disagreement",
	"duplicate_active_receipts_per_payment",
	"duplicate_invoices_per_schedule",
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
	actualValue?: string | null;
	expectedValue?: string | null;
	actualStatus?: string | null;
	expectedStatus?: string | null;
	invalidLinkCount?: number | string | null;
	details?: unknown;
};

export type Mismatch = RawMismatch & {
	id: string;
	safeFixAvailable: boolean;
	intendedAction: SafeFixAction | null;
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
	if (value === null || value === undefined) return 0;
	return typeof value === "number" ? value : Number.parseInt(value, 10) || 0;
}

export function classifyMismatch(raw: RawMismatch): Mismatch {
	const action = SAFE_ACTIONS[raw.mismatchType] ?? null;
	const noInvalidLinks = toInteger(raw.invalidLinkCount) === 0;
	const isCancelled = raw.actualStatus === "cancelled";
	const draftHasApplication =
		raw.actualStatus === "draft" &&
		raw.expectedStatus !== undefined &&
		raw.expectedStatus !== "draft";
	const safeFixAvailable =
		action !== null && noInvalidLinks && !isCancelled && !draftHasApplication;

	return {
		...raw,
		id: `${raw.mismatchType}:${raw.organizationId}:${raw.entityType}:${raw.entityId}${raw.relatedId ? `:${raw.relatedId}` : ""}`,
		safeFixAvailable,
		intendedAction: safeFixAvailable ? action : null,
	};
}

function compareNullable(a: string | null | undefined, b: string | null | undefined) {
	return (a ?? "").localeCompare(b ?? "");
}

export function sortMismatches(mismatches: Mismatch[]): Mismatch[] {
	return [...mismatches].sort(
		(a, b) =>
			compareNullable(a.organizationId, b.organizationId) ||
			compareNullable(a.mismatchType, b.mismatchType) ||
			compareNullable(a.entityType, b.entityType) ||
			compareNullable(a.entityId, b.entityId) ||
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
	for (const key of ["evidence", "options", "consequences", "mismatchIds"] as const) {
		if (
			!Array.isArray(record[key]) ||
			record[key].some((item) => typeof item !== "string" || item.trim() === "")
		) {
			errors.push(`${key} must be an array of non-empty strings`);
		}
	}

	if (errors.length > 0) return { valid: false, errors };
	return { valid: true, value: record as unknown as DecisionRecord };
}

export function summarize(mismatches: Mismatch[]) {
	const byType = Object.fromEntries(
		MISMATCH_TYPES.map((type) => [
			type,
			mismatches.filter((mismatch) => mismatch.mismatchType === type).length,
		]),
	) as Record<MismatchType, number>;

	return {
		actionable: mismatches.length,
		safeFixable: mismatches.filter((mismatch) => mismatch.safeFixAvailable)
			.length,
		manualReview: mismatches.filter((mismatch) => !mismatch.safeFixAvailable)
			.length,
		byType,
	};
}
