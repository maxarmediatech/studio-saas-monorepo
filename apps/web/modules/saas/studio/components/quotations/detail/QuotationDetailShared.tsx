import type { QuoteDetail } from "@repo/api/modules/studio/schemas/quote";
import { Badge } from "@repo/ui/components/badge";
import { QUOTE_STATUS_LABELS } from "../quotation-helpers";

export function QuoteStatusBadge({
	status,
}: {
	status: QuoteDetail["status"];
}) {
	return (
		<Badge variant={status === "converted" ? "default" : "outline"}>
			{QUOTE_STATUS_LABELS[status]}
		</Badge>
	);
}

export function DetailMetric({
	label,
	value,
	hint,
}: {
	label: string;
	value: string;
	hint?: string;
}) {
	return (
		<div className="bg-background p-5">
			<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</p>
			<p className="mt-2 truncate font-semibold">{value}</p>
			{hint ? (
				<p className="mt-1 text-xs text-muted-foreground">{hint}</p>
			) : null}
		</div>
	);
}

export function formatQuoteDate(value: string) {
	return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
		new Date(value),
	);
}

export function formatQuoteDateTime(value: string) {
	return new Intl.DateTimeFormat("en-IN", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

export function formatMoney(currency: string, value: string) {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency,
		maximumFractionDigits: 2,
	}).format(Number(value));
}
