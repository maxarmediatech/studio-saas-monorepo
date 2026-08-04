import type { QuoteDetail } from "@repo/api/modules/studio/schemas/quote";
import { Separator } from "@repo/ui/components/separator";
import { HistoryIcon } from "lucide-react";
import { formatQuoteDateTime } from "./QuotationDetailShared";

export function QuotationTerms({ quote }: { quote: QuoteDetail }) {
	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
			<section className="flex flex-col gap-3">
				<h2 className="font-semibold">Terms</h2>
				{quote.terms?.length ? (
					<ol className="flex list-decimal flex-col gap-3 pl-5 text-sm leading-6">
						{quote.terms.map((term, index) => (
							<li key={index}>{term}</li>
						))}
					</ol>
				) : (
					<p className="text-sm text-muted-foreground">
						No fixed terms.
					</p>
				)}
			</section>
			<aside className="flex flex-col gap-5 lg:border-l lg:pl-6">
				<div>
					<h3 className="text-sm font-medium">Client message</h3>
					<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
						{quote.clientMessage || "—"}
					</p>
				</div>
				<Separator className="lg:hidden" />
				<div>
					<h3 className="text-sm font-medium">Internal notes</h3>
					<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
						{quote.internalNotes || "—"}
					</p>
				</div>
			</aside>
		</div>
	);
}

export function QuotationHistory({ quote }: { quote: QuoteDetail }) {
	const rows = [
		["Created", quote.createdAt],
		["Updated", quote.updatedAt],
		["Sent", quote.sentAt],
		["Accepted", quote.acceptance?.acceptedAt],
		["Converted", quote.convertedAt],
		["Declined", quote.declinedAt],
		["Expired", quote.expiredAt],
		["Superseded", quote.supersededAt],
	].filter((row): row is [string, string] => Boolean(row[1]));
	return (
		<section className="flex flex-col gap-4">
			<h2 className="flex items-center gap-2 font-semibold">
				<HistoryIcon className="size-4" aria-hidden="true" />
				Lifecycle history
			</h2>
			<ol className="border-l pl-5">
				{rows.map(([label, date]) => (
					<li key={label} className="relative pb-5 last:pb-0">
						<span className="absolute -left-[1.55rem] top-1 size-2 rounded-full bg-primary" />
						<p className="font-medium">{label}</p>
						<p className="text-sm text-muted-foreground">
							{formatQuoteDateTime(date)}
						</p>
					</li>
				))}
			</ol>
			{quote.supersedesQuoteId ? (
				<p className="text-sm text-muted-foreground">
					This version supersedes quotation ID{" "}
					<span className="font-mono">{quote.supersedesQuoteId}</span>
					.
				</p>
			) : null}
		</section>
	);
}
