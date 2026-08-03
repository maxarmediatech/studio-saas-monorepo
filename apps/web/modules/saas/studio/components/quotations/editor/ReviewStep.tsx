import type { QuoteDraftContentInput } from "@repo/api/modules/studio/schemas/quote";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { AlertCircleIcon, InfoIcon } from "lucide-react";
import { getEditorErrorTarget, optionTotal } from "../quotation-helpers";
import { EditorHeading } from "./EditorHeading";
import type { EditorErrors, EditorStep } from "./types";

const STEP_LABELS: Record<EditorStep, string> = {
	proposal: "Proposal",
	pricing: "Pricing",
	booking: "Booking",
	operations: "Operations",
	review: "Review",
};

export function ReviewStep({
	draft,
	errors,
	onGo,
}: {
	draft: QuoteDraftContentInput;
	errors: EditorErrors;
	onGo: (step: EditorStep) => void;
}) {
	const totalLines = draft.options.reduce(
		(sum, option) => sum + option.lineItems.length,
		0,
	);
	const operationCount = draft.options.reduce((sum, option) => {
		const booking = option.bookingBlueprint.booking;
		return (
			sum +
			(booking.events?.length ?? 0) +
			(booking.shoots?.length ?? 0) +
			(booking.deliverables?.length ?? 0)
		);
	}, 0);
	return (
		<>
			<EditorHeading
				title="Review draft"
				description="Confirm the commercial offer and conversion-ready booking plan."
			/>
			{Object.keys(errors).length > 0 && (
				<Alert variant="destructive">
					<AlertCircleIcon />
					<AlertTitle>Draft needs attention</AlertTitle>
					<AlertDescription>
						<ul className="list-disc pl-5">
							{Object.entries(errors)
								.slice(0, 8)
								.map(([path, message]) => {
									const target = getEditorErrorTarget(
										path.split("."),
									);
									return (
										<li key={path}>
											<button
												type="button"
												className="text-left underline underline-offset-2"
												onClick={() =>
													onGo(target.step)
												}
											>
												{STEP_LABELS[target.step]} ·{" "}
												{path}: {message}
											</button>
										</li>
									);
								})}
						</ul>
					</AlertDescription>
				</Alert>
			)}
			<div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
				{[
					["Participants", draft.participants.length],
					["Options", draft.options.length],
					["Priced lines", totalLines],
					["Operational records", operationCount],
				].map(([label, value]) => (
					<div key={label} className="bg-background p-5">
						<p className="text-sm text-muted-foreground">{label}</p>
						<p className="mt-1 text-2xl font-semibold tabular-nums">
							{value}
						</p>
					</div>
				))}
			</div>
			<section className="flex flex-col gap-3">
				<h3 className="font-medium">Option comparison</h3>
				{draft.options.map((option, index) => (
					<div
						key={index}
						className="flex items-center justify-between rounded-lg border p-4"
					>
						<div>
							<p className="font-medium">
								{option.name || `Option ${index + 1}`}
							</p>
							<p className="text-sm text-muted-foreground">
								{option.lineItems.length} lines ·{" "}
								{option.bookingBlueprint.booking.shoots
									?.length ?? 0}{" "}
								shoots ·{" "}
								{option.bookingBlueprint.booking.deliverables
									?.length ?? 0}{" "}
								deliverables
							</p>
						</div>
						<p className="font-semibold tabular-nums">
							{draft.currency} {optionTotal(option).toFixed(2)}
						</p>
					</div>
				))}
			</section>
			<Alert>
				<InfoIcon />
				<AlertTitle>Server-saved draft</AlertTitle>
				<AlertDescription>
					Saving creates or updates a server-side draft. Sending is a
					separate confirmed action because it locks this version.
				</AlertDescription>
			</Alert>
			<Button
				type="button"
				variant="outline"
				onClick={() => onGo("proposal")}
			>
				Edit proposal
			</Button>
		</>
	);
}
