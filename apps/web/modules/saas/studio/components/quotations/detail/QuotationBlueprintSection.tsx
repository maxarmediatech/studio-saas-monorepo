import type { QuoteDetail } from "@repo/api/modules/studio/schemas/quote";
import { Badge } from "@repo/ui/components/badge";
import { Separator } from "@repo/ui/components/separator";
import {
	CalendarIcon,
	FileTextIcon,
	PaperclipIcon,
	UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import {
	DetailMetric,
	formatMoney,
	formatQuoteDate,
} from "./QuotationDetailShared";

export function QuotationBlueprintSection({ quote }: { quote: QuoteDetail }) {
	return (
		<div className="flex flex-col gap-5">
			{quote.options.map((option) => {
				const booking = option.bookingBlueprint.booking;
				return (
					<section
						key={option.id}
						className="overflow-hidden rounded-lg border"
					>
						<header className="flex items-start justify-between gap-4 p-4">
							<div>
								<h2 className="font-semibold">{option.name}</h2>
								<p className="text-sm text-muted-foreground">
									Blueprint v
									{option.bookingBlueprint.schemaVersion} ·{" "}
									{booking.name}
								</p>
							</div>
							{quote.acceptance?.quoteOptionId === option.id ? (
								<Badge>Accepted blueprint</Badge>
							) : null}
						</header>
						<div className="grid gap-px bg-border sm:grid-cols-3">
							<DetailMetric
								label="Booking date"
								value={booking.bookingDate}
							/>
							<DetailMetric
								label="Booking type"
								value={booking.bookingType}
							/>
							<DetailMetric
								label="Package type"
								value={booking.packageType}
							/>
						</div>
						<div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
							<Count
								icon={<CalendarIcon />}
								label="Events"
								value={booking.events?.length ?? 0}
							/>
							<Count
								icon={<FileTextIcon />}
								label="Shoots"
								value={booking.shoots?.length ?? 0}
							/>
							<Count
								icon={<FileTextIcon />}
								label="Deliverables"
								value={booking.deliverables?.length ?? 0}
							/>
							<Count
								icon={<UsersIcon />}
								label="Schedules"
								value={booking.paymentSchedules?.length ?? 0}
							/>
						</div>
						{booking.note || booking.contractAttachment ? (
							<>
								<Separator />
								<div className="flex flex-col gap-3 p-4 text-sm">
									{booking.note ? (
										<p className="whitespace-pre-wrap text-muted-foreground">
											{booking.note}
										</p>
									) : null}
									{booking.contractAttachment ? (
										<p className="flex items-center gap-2">
											<PaperclipIcon
												className="size-4"
												aria-hidden="true"
											/>
											{booking.contractAttachment.name}
										</p>
									) : null}
								</div>
							</>
						) : null}
						<OperationalLists quote={quote} booking={booking} />
					</section>
				);
			})}
		</div>
	);
}

function OperationalLists({
	quote,
	booking,
}: {
	quote: QuoteDetail;
	booking: QuoteDetail["options"][number]["bookingBlueprint"]["booking"];
}) {
	const sections = [
		{
			title: "Events",
			rows: (booking.events ?? []).map(
				(item) =>
					`${item.eventType} · ${formatQuoteDate(item.eventDate)}${item.venue ? ` · ${item.venue}` : ""}`,
			),
		},
		{
			title: "Shoots",
			rows: (booking.shoots ?? []).map(
				(item) =>
					`${item.name} · ${item.shootDate}${item.startTime ? ` at ${item.startTime}` : ""} · ${item.crewAssignments?.length ?? 0} crew`,
			),
		},
		{
			title: "Deliverables",
			rows: (booking.deliverables ?? []).map(
				(item) =>
					`${item.name} · qty ${item.quantity}${item.dueDate ? ` · due ${item.dueDate}` : ""} · ${item.crewAssignments?.length ?? 0} crew`,
			),
		},
		{
			title: "Payment schedule",
			rows: (booking.paymentSchedules ?? []).map(
				(item) =>
					`${item.name} · ${formatMoney(quote.currency, item.amount)} · due ${item.dueDate}`,
			),
		},
	].filter((section) => section.rows.length > 0);
	if (sections.length === 0) {
		return null;
	}
	return (
		<>
			<Separator />
			<div className="grid gap-5 p-4 lg:grid-cols-2">
				{sections.map((section) => (
					<SummaryList key={section.title} {...section} />
				))}
			</div>
		</>
	);
}

function Count({
	icon,
	label,
	value,
}: {
	icon: ReactNode;
	label: string;
	value: number;
}) {
	return (
		<div className="flex items-center gap-3 text-sm text-muted-foreground">
			<span className="[&_svg]:size-4">{icon}</span>
			<span>
				{value} {label}
			</span>
		</div>
	);
}

function SummaryList({ title, rows }: { title: string; rows: string[] }) {
	return (
		<section className="flex flex-col gap-2">
			<h3 className="text-sm font-medium">{title}</h3>
			<ul className="flex flex-col gap-1 text-sm text-muted-foreground">
				{rows.map((row, index) => (
					<li key={`${title}-${index}`}>{row}</li>
				))}
			</ul>
		</section>
	);
}
