import { FieldGroup } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { OperationCard, OperationSection } from "./OperationSection";
import type { BookingDraft } from "./types";

export function PaymentSchedulesEditor({
	booking,
	onChange,
	error,
}: {
	booking: BookingDraft;
	onChange: (booking: BookingDraft) => void;
	error?: string;
}) {
	const schedules = booking.paymentSchedules ?? [];
	const updateSchedule = (
		index: number,
		value: Partial<(typeof schedules)[number]>,
	) =>
		onChange({
			...booking,
			paymentSchedules: schedules.map((item, itemIndex) =>
				itemIndex === index ? { ...item, ...value } : item,
			),
		});
	return (
		<OperationSection
			id="quotation-paymentSchedules"
			error={error}
			title="Payment schedule"
			description="Collection milestones must add up to this option’s server-computed total."
			isEmpty={schedules.length === 0}
			onAdd={() =>
				onChange({
					...booking,
					paymentSchedules: [
						...schedules,
						{
							name: "",
							amount: "0.00",
							dueDate: booking.bookingDate,
							notes: "",
						},
					],
				})
			}
		>
			<FieldGroup className="gap-3">
				{schedules.map((schedule, index) => (
					<OperationCard
						key={index}
						onRemove={() =>
							onChange({
								...booking,
								paymentSchedules: schedules.filter(
									(_, itemIndex) => itemIndex !== index,
								),
							})
						}
					>
						<div className="grid gap-3 sm:grid-cols-3">
							<Input
								aria-label="Payment milestone name"
								value={schedule.name}
								placeholder="Milestone name"
								onChange={(event) =>
									updateSchedule(index, {
										name: event.target.value,
									})
								}
							/>
							<Input
								aria-label="Payment milestone amount"
								type="number"
								min="0"
								step="0.01"
								value={schedule.amount}
								onChange={(event) =>
									updateSchedule(index, {
										amount: event.target.value,
									})
								}
							/>
							<Input
								aria-label="Payment milestone due date"
								type="date"
								value={schedule.dueDate ?? ""}
								onChange={(event) =>
									updateSchedule(index, {
										dueDate: event.target.value,
									})
								}
							/>
						</div>
						<Textarea
							aria-label="Payment milestone notes"
							value={schedule.notes ?? ""}
							placeholder="Payment notes"
							onChange={(event) =>
								updateSchedule(index, {
									notes: event.target.value,
								})
							}
						/>
					</OperationCard>
				))}
			</FieldGroup>
		</OperationSection>
	);
}
