import type { QuotationDocumentV1 } from "@repo/api/modules/studio/schemas/quotation-document";
import { strictQuotationDocumentV1Schema } from "@repo/api/modules/studio/schemas/quotation-document";
import type { QuotationStepId } from "./quotation-wizard-data";

export interface QuotationFieldError {
	fieldId: string;
	message: string;
	step: QuotationStepId;
}

const rootsByStep: Record<QuotationStepId, Set<string>> = {
	client: new Set([
		"quotationDate",
		"quotationType",
		"title",
		"participants",
	]),
	events: new Set(["events"]),
	packages: new Set(["packages", "recommendedPackageKey"]),
	terms: new Set(["deliveryTimelines", "paymentMilestones", "fixedTerms"]),
	preview: new Set(),
};

function issueStep(root: string): QuotationStepId {
	for (const step of ["client", "events", "packages", "terms"] as const) {
		if (rootsByStep[step].has(root)) {
			return step;
		}
	}
	return "terms";
}

function issueFieldId(
	document: QuotationDocumentV1,
	path: PropertyKey[],
): string {
	const root = String(path[0] ?? "");
	const index = typeof path[1] === "number" ? path[1] : 0;
	if (root === "quotationDate") {
		return "quotation-date";
	}
	if (root === "quotationType") {
		return "quotation-type";
	}
	if (root === "title") {
		return "quotation-title";
	}
	if (root === "participants") {
		return `quotation-client-${document.participants[index]?.key ?? "first"}-name`;
	}
	if (root === "events") {
		const event = document.events[index];
		return path.includes("fixedDate") || path.includes("dateWindow")
			? `quotation-event-${event?.key ?? "first"}-date`
			: `quotation-event-${event?.key ?? "first"}-name`;
	}
	if (root === "packages") {
		const item = document.packages[index];
		return path.includes("price")
			? `quotation-package-${item?.key ?? "first"}-price`
			: `quotation-package-${item?.key ?? "first"}-name`;
	}
	if (root === "recommendedPackageKey") {
		const recommended = document.packages.find(
			(item) => item.key === document.recommendedPackageKey,
		);
		return `quotation-package-${recommended?.key ?? document.packages[0]?.key ?? "first"}-name`;
	}
	if (root === "paymentMilestones") {
		return `quotation-payment-${document.paymentMilestones[index]?.key ?? "first"}-percentage`;
	}
	return "quotation-terms";
}

export function validateQuotationDocument(
	document: QuotationDocumentV1,
	step?: Exclude<QuotationStepId, "preview">,
	options: { allowUnresolvedClients?: boolean } = {},
): QuotationFieldError[] {
	const result = strictQuotationDocumentV1Schema.safeParse(document);
	if (result.success) {
		return [];
	}
	return result.error.issues.flatMap((issue) => {
		const root = String(issue.path[0] ?? "");
		const targetStep = issueStep(root);
		if (step && targetStep !== step) {
			return [];
		}
		if (
			options.allowUnresolvedClients &&
			root === "participants" &&
			issue.path.includes("clientId")
		) {
			return [];
		}
		return [
			{
				fieldId: issueFieldId(document, issue.path),
				message: issue.message,
				step: targetStep,
			},
		];
	});
}

export function fieldErrorMap(errors: QuotationFieldError[]) {
	return Object.fromEntries(
		errors.map((error) => [error.fieldId, error.message]),
	);
}

export function focusFirstQuotationError(
	error: QuotationFieldError,
	setStep: (step: QuotationStepId) => void,
	findElement: (id: string) => { focus: () => void } | null,
	schedule: (callback: () => void) => void,
): void {
	setStep(error.step);
	schedule(() => findElement(error.fieldId)?.focus());
}
