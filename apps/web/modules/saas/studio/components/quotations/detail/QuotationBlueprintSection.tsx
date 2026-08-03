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
				const legacy =
					option.bookingBlueprint.schemaVersion === 1
						? option.bookingBlueprint.booking
						: null;
				const documentBooking =
					option.bookingBlueprint.schemaVersion === 2
						? option.bookingBlueprint.booking
						: null;
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
								value={legacy?.bookingDate ?? "Acceptance date"}
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
								value={legacy?.shoots?.length ?? 0}
							/>
							<Count
								icon={<FileTextIcon />}
								label="Deliverables"
								value={booking.deliverables?.length ?? 0}
							/>
							<Count
								icon={<UsersIcon />}
								label="Schedules"
								value={
									documentBooking?.paymentMilestones.length ??
									legacy?.paymentSchedules?.length ??
									0
								}
							/>
						</div>
						{legacy?.note || legacy?.contractAttachment ? (
							<>
								<Separator />
								<div className="flex flex-col gap-3 p-4 text-sm">
									{legacy.note ? (
										<p className="whitespace-pre-wrap text-muted-foreground">
											{legacy.note}
										</p>
									) : null}
									{legacy.contractAttachment ? (
										<p className="flex items-center gap-2">
											<PaperclipIcon
												className="size-4"
												aria-hidden="true"
											/>
											{legacy.contractAttachment.name}
										</p>
									) : null}
								</div>
							</>
						) : null}
						<OperationalLists
							quote={quote}
							blueprint={option.bookingBlueprint}
						/>
					</section>
				);
			})}
		</div>
	);
}

function OperationalLists({
	quote,
	blueprint,
}: {
	quote: QuoteDetail;
	blueprint: QuoteDetail["options"][number]["bookingBlueprint"];
}) {
	const booking = blueprint.booking;
	const legacy = blueprint.schemaVersion === 1 ? blueprint.booking : null;
	const documentBooking =
		blueprint.schemaVersion === 2 ? blueprint.booking : null;
	const sections = [
		{
			title: "Events",
			rows: (booking.events ?? []).map((item) => {
				const venue = "location" in item ? item.location : item.venue;
				const date = item.eventDate
					? formatQuoteDate(item.eventDate)
					: "Date not scheduled";
				return `${item.eventType} · ${date}${venue ? ` · ${venue}` : ""}`;
			}),
		},
		{
			title: "Shoots",
			rows: (legacy?.shoots ?? []).map(
				(item) =>
					`${item.name} · ${item.shootDate}${item.startTime ? ` at ${item.startTime}` : ""} · ${item.crewAssignments?.length ?? 0} crew`,
			),
		},
		{
			title: "Deliverables",
			rows: (booking.deliverables ?? []).map((item) => {
				const dueDate = "dueDate" in item ? item.dueDate : undefined;
				const crew =
					"crewAssignments" in item
						? (item.crewAssignments?.length ?? 0)
						: 0;
				return `${item.name} · qty ${item.quantity}${dueDate ? ` · due ${dueDate}` : ""} · ${crew} crew`;
			}),
		},
		{
			title: "Payment schedule",
			rows: documentBooking
				? documentBooking.paymentMilestones.map(
						(item) =>
							`${item.label} · ${item.percentage}% · Date not scheduled`,
					)
				: (legacy?.paymentSchedules ?? []).map(
						(item) =>
							`${item.name} · ${formatMoney(quote.currency, item.amount)} · ${item.dueDate ? `due ${item.dueDate}` : "Date not scheduled"}`,
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
