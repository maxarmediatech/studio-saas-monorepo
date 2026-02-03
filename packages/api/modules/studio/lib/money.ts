/**
 * Money utilities (string cents conversion)
 *
 * We store money as strings to preserve precision. These helpers convert to/from
 * integer cents for safe arithmetic without floating point rounding issues.
 */

export function moneyToCents(value: string): number {
	const [whole, fraction = ""] = value.split(".");
	const fractionPadded = (fraction + "00").slice(0, 2);
	return Number(whole) * 100 + Number(fractionPadded);
}

export function centsToMoney(cents: number): string {
	const whole = Math.floor(cents / 100);
	const fraction = String(cents % 100).padStart(2, "0");
	return `${whole}.${fraction}`;
}

