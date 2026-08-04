import { Checkbox } from "@repo/ui/components/checkbox";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { CrewAssignmentsEditor } from "./CrewAssignmentsEditor";
import { OperationCard, OperationSection } from "./OperationSection";
import type { BookingDraft, CrewOption } from "./types";

export function DeliverablesEditor({
	booking,
	crews,
	onChange,
	error,
}: {
	booking: BookingDraft;
	crews: CrewOption[];
	onChange: (booking: BookingDraft) => void;
	error?: string;
}) {
	const deliverables = booking.deliverables ?? [];
	const updateDeliverable = (
		index: number,
		value: Partial<(typeof deliverables)[number]>,
	) =>
		onChange({
			...booking,
			deliverables: deliverables.map((item, itemIndex) =>
				itemIndex === index ? { ...item, ...value } : item,
			),
		});
	return (
		<OperationSection
			id="quotation-deliverables"
			error={error}
			title="Deliverables & crew"
			description="Outputs, due dates, quantities, costs, and delivery crew."
			isEmpty={deliverables.length === 0}
			onAdd={() =>
				onChange({
					...booking,
					deliverables: [
						...deliverables,
						{
							name: "",
							description: "",
							dueDate: "",
							quantity: 1,
							isPackageIncluded: true,
							crewAssignments: [],
						},
					],
				})
			}
		>
			<FieldGroup className="gap-3">
				{deliverables.map((deliverable, index) => (
					<OperationCard
						key={index}
						onRemove={() =>
							onChange({
								...booking,
								deliverables: deliverables.filter(
									(_, itemIndex) => itemIndex !== index,
								),
							})
						}
					>
						<div className="grid gap-3 sm:grid-cols-3">
							<Input
								aria-label="Deliverable name"
								value={deliverable.name}
								placeholder="Deliverable name"
								onChange={(event) =>
									updateDeliverable(index, {
										name: event.target.value,
									})
								}
							/>
							<Input
								aria-label="Deliverable due date"
								type="date"
								value={deliverable.dueDate ?? ""}
								onChange={(event) =>
									updateDeliverable(index, {
										dueDate: event.target.value,
									})
								}
							/>
							<Input
								aria-label="Deliverable quantity"
								type="number"
								min="1"
								value={deliverable.quantity}
								onChange={(event) =>
									updateDeliverable(index, {
										quantity: Number(event.target.value),
									})
								}
							/>
						</div>
						<Textarea
							aria-label="Deliverable description"
							value={deliverable.description ?? ""}
							placeholder="Deliverable description"
							onChange={(event) =>
								updateDeliverable(index, {
									description: event.target.value,
								})
							}
						/>
						<div className="grid gap-3 sm:grid-cols-2">
							<Field
								orientation="horizontal"
								className="rounded-md border p-3"
							>
								<Checkbox
									id={`deliverable-package-included-${index}`}
									checked={deliverable.isPackageIncluded}
									onCheckedChange={(checked) =>
										updateDeliverable(index, {
											isPackageIncluded: checked === true,
											cost: checked
												? undefined
												: deliverable.cost,
										})
									}
								/>
								<FieldLabel
									htmlFor={`deliverable-package-included-${index}`}
								>
									Included in package
								</FieldLabel>
							</Field>
							{!deliverable.isPackageIncluded && (
								<Input
									aria-label="Custom deliverable cost"
									type="number"
									min="0"
									step="0.01"
									value={deliverable.cost ?? ""}
									placeholder="Custom cost"
									onChange={(event) =>
										updateDeliverable(index, {
											cost: event.target.value,
										})
									}
								/>
							)}
						</div>
						<CrewAssignmentsEditor
							crews={crews}
							assignments={deliverable.crewAssignments ?? []}
							onChange={(assignments) =>
								updateDeliverable(index, {
									crewAssignments: assignments.map(
										({ crewId, isLead }) => ({
											crewId,
											isLead,
										}),
									),
								})
							}
						/>
					</OperationCard>
				))}
			</FieldGroup>
		</OperationSection>
	);
}
