import type { QuoteSummary } from "@repo/api/modules/studio/schemas/quote";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
import Link from "next/link";
import {
	formatQuoteTotal,
	QUOTE_STATUS_LABELS,
	type QuoteAction,
} from "../quotation-helpers";

export type QuotationRowProps = {
	quote: QuoteSummary;
	organizationSlug: string;
	canOpen: boolean;
	actions: QuoteAction[];
	onAction: (action: "send" | "revise") => void;
};

function StatusBadge({ status }: { status: QuoteSummary["status"] }) {
	return (
		<Badge variant={status === "converted" ? "default" : "outline"}>
			{QUOTE_STATUS_LABELS[status]}
		</Badge>
	);
}

function SummaryActions({
	actions,
	onAction,
	variant = "ghost",
}: Pick<QuotationRowProps, "actions" | "onAction"> & {
	variant?: "ghost" | "outline";
}) {
	const summaryActions = actions.filter(
		(action): action is "send" | "revise" =>
			action === "send" || action === "revise",
	);
	if (summaryActions.length === 0) {
		return null;
	}
	return (
		<div className="flex justify-end gap-1">
			{summaryActions.map((action) => (
				<Button
					type="button"
					key={action}
					size="sm"
					variant={variant}
					onClick={() => onAction(action)}
				>
					{action === "send" ? "Send" : "Revise"}
				</Button>
			))}
		</div>
	);
}

function QuoteIdentity({
	quote,
	organizationSlug,
	canOpen,
}: Pick<QuotationRowProps, "quote" | "organizationSlug" | "canOpen">) {
	const content = (
		<>
			<span className="font-medium">{quote.title}</span>
			<span className="block font-mono text-xs text-muted-foreground">
				{quote.quoteNumber} · v{quote.version}
			</span>
		</>
	);
	return canOpen ? (
		<Link
			className="hover:underline"
			href={`/app/${organizationSlug}/quotations/${quote.id}`}
		>
			{content}
		</Link>
	) : (
		content
	);
}

function DesktopQuoteRow(props: QuotationRowProps) {
	const { quote } = props;
	return (
		<TableRow>
			<TableCell>
				<QuoteIdentity {...props} />
			</TableCell>
			<TableCell>
				<StatusBadge status={quote.status} />
			</TableCell>
			<TableCell>{quote.primaryClient?.name ?? "—"}</TableCell>
			<TableCell>{quote.optionCount}</TableCell>
			<TableCell className="text-right tabular-nums">
				{formatQuoteTotal(quote) ?? "—"}
			</TableCell>
			<TableCell>
				{quote.expiresAt
					? new Intl.DateTimeFormat("en-IN", {
							dateStyle: "medium",
						}).format(new Date(quote.expiresAt))
					: "—"}
			</TableCell>
			<TableCell>
				<SummaryActions
					actions={props.actions}
					onAction={props.onAction}
				/>
			</TableCell>
		</TableRow>
	);
}

function MobileQuote(props: QuotationRowProps) {
	const { quote } = props;
	return (
		<article className="flex flex-col gap-3 p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<QuoteIdentity {...props} />
				</div>
				<StatusBadge status={quote.status} />
			</div>
			<div className="flex justify-between gap-3 text-sm">
				<span className="truncate text-muted-foreground">
					{quote.primaryClient?.name ?? "No primary client"}
				</span>
				<span className="shrink-0 font-medium tabular-nums">
					{formatQuoteTotal(quote) ?? "—"}
				</span>
			</div>
			<SummaryActions
				actions={props.actions}
				onAction={props.onAction}
				variant="outline"
			/>
		</article>
	);
}

export function QuotationRows({ rows }: { rows: QuotationRowProps[] }) {
	return (
		<>
			<div className="hidden overflow-hidden rounded-lg border md:block">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Quotation</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Client</TableHead>
							<TableHead>Options</TableHead>
							<TableHead className="text-right">Value</TableHead>
							<TableHead>Expiry</TableHead>
							<TableHead className="text-right">
								Actions
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((props) => (
							<DesktopQuoteRow key={props.quote.id} {...props} />
						))}
					</TableBody>
				</Table>
			</div>
			<div className="divide-y rounded-lg border md:hidden">
				{rows.map((props) => (
					<MobileQuote key={props.quote.id} {...props} />
				))}
			</div>
		</>
	);
}
