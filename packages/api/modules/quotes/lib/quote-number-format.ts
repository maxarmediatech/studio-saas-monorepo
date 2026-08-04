import { deriveStudioPrefix } from "../../bookings/helpers/derive-studio-prefix";
import { getDateParts, normalizeTimeZone } from "../../studio/lib/date-helpers";

/** Tenant-local monthly prefix: {STUDIO}-Q-{YYMM}. */
export function getQuoteNumberPrefix(
	organizationName: string,
	organizationTimeZone: string,
	now: Date,
): string {
	const parts = getDateParts(now, normalizeTimeZone(organizationTimeZone));
	const yearMonth = `${parts.year.slice(-2)}${parts.month}`;
	return `${deriveStudioPrefix(organizationName)}-Q-${yearMonth}`;
}
