import { ORPCError } from "@orpc/server";
import type {
	NormalizedQuoteOption,
	QuoteDraftContentInput,
	QuoteLineItemInput,
} from "../../studio/schemas/quote";

const MAX_CENTS = BigInt("999999999999");

function scaledInteger(value: string, scale: number): bigint {
	const [whole = "0", fraction = ""] = value.split(".");
	return BigInt(`${whole}${fraction.padEnd(scale, "0")}`);
}

function centsToMoney(value: bigint): string {
	const whole = value / BigInt(100);
	const fraction = String(value % BigInt(100)).padStart(2, "0");
	return `${whole}.${fraction}`;
}

function moneyToCents(value: string): bigint {
	return scaledInteger(value, 2);
}

export function computeQuoteLineAmount(item: QuoteLineItemInput): string {
	if ("amount" in item) {
		return centsToMoney(moneyToCents(item.amount));
	}
	const productAtFourDecimals =
		scaledInteger(item.quantity, 2) * moneyToCents(item.unitPrice);
	const roundedCents = (productAtFourDecimals + BigInt(50)) / BigInt(100);
	if (roundedCents > MAX_CENTS) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Line amount exceeds 9999999999.99",
		});
	}
	return centsToMoney(roundedCents);
}

export function normalizeQuoteOptions(
	options: QuoteDraftContentInput["options"],
): NormalizedQuoteOption[] {
	return options.map((option, optionIndex) => {
		const lineItems = option.lineItems.map((item, lineIndex) => ({
			...item,
			amount: computeQuoteLineAmount(item),
			sortOrder: lineIndex,
		}));
		const subtotalCents = lineItems.reduce(
			(sum, item) => sum + moneyToCents(item.amount),
			BigInt(0),
		);
		const discountCents = moneyToCents(option.discountAmount);
		const taxCents = moneyToCents(option.taxAmount);
		if (discountCents > subtotalCents) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Discount cannot exceed subtotal",
			});
		}
		const totalCents = subtotalCents - discountCents + taxCents;
		if (subtotalCents > MAX_CENTS || totalCents > MAX_CENTS) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Quote option total exceeds 9999999999.99",
			});
		}
		const schedules = option.bookingBlueprint.booking.paymentSchedules;
		const normalizedSchedules = schedules?.map((schedule, sortOrder) => ({
			...schedule,
			sortOrder,
		}));
		if (normalizedSchedules) {
			const scheduleTotalCents = normalizedSchedules.reduce(
				(sum, schedule) => sum + moneyToCents(schedule.amount),
				BigInt(0),
			);
			if (scheduleTotalCents > MAX_CENTS) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Payment schedule aggregate exceeds 9999999999.99",
				});
			}
			if (scheduleTotalCents !== totalCents) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Payment schedules must equal the quote option total",
				});
			}
		}
		return {
			...option,
			bookingBlueprint: {
				...option.bookingBlueprint,
				booking: {
					...option.bookingBlueprint.booking,
					paymentSchedules: normalizedSchedules,
				},
			},
			subtotal: centsToMoney(subtotalCents),
			totalAmount: centsToMoney(totalCents),
			sortOrder: optionIndex,
			lineItems,
		};
	});
}

export function findInvalidParticipantClients(
	participants: QuoteDraftContentInput["participants"],
	activeClientIds: Iterable<string>,
): string[] {
	const active = new Set(activeClientIds);
	return [...new Set(participants.map((item) => item.clientId))].filter(
		(id) => !active.has(id),
	);
}

export function normalizeQuoteContent(content: QuoteDraftContentInput) {
	return {
		...content,
		participants: content.participants.map((participant, sortOrder) => ({
			...participant,
			sortOrder,
		})),
		options: normalizeQuoteOptions(content.options),
	};
}
