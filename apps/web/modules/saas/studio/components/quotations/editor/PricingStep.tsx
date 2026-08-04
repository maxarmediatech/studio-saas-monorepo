import type { QuoteDraftContentInput } from "@repo/api/modules/studio/schemas/quote";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { createEmptyOption, optionTotal } from "../quotation-helpers";
import { EditorHeading } from "./EditorHeading";
import type { EditorErrors, OptionDraft } from "./types";

type LineType = "item" | "service" | "milestone" | "expense";

export function PricingStep({
	draft,
	selected,
	setSelected,
	change,
	updateOption,
	errors,
}: {
	draft: QuoteDraftContentInput;
	selected: number;
	setSelected: (index: number) => void;
	change: (draft: QuoteDraftContentInput) => void;
	updateOption: (
		index: number,
		fn: (option: OptionDraft) => OptionDraft,
	) => void;
	errors: EditorErrors;
}) {
	const option = draft.options[selected];
	if (!option) {
		return null;
	}

	const updateLine = (
		lineIndex: number,
		updater: (
			line: OptionDraft["lineItems"][number],
		) => OptionDraft["lineItems"][number],
	) =>
		updateOption(selected, (item) => ({
			...item,
			lineItems: item.lineItems.map((line, index) =>
				index === lineIndex ? updater(line) : line,
			),
		}));

	return (
		<>
			<EditorHeading
				title="Priced options"
				description="Compare one or more scopes. Amounts and totals are calculated by the server."
			/>
			<div className="flex flex-wrap gap-2">
				<ToggleGroup
					type="single"
					variant="outline"
					spacing={2}
					value={String(selected)}
					onValueChange={(value) => {
						if (value) {
							setSelected(Number(value));
						}
					}}
					aria-label="Quotation option"
				>
					{draft.options.map((item, index) => (
						<ToggleGroupItem key={index} value={String(index)}>
							{item.name || `Option ${index + 1}`}
							{item.isRecommended ? (
								<Badge variant="secondary">Recommended</Badge>
							) : null}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
				<Button
					type="button"
					variant="ghost"
					onClick={() => {
						change({
							...draft,
							options: [...draft.options, createEmptyOption()],
						});
						setSelected(draft.options.length);
					}}
				>
					<PlusIcon data-icon="inline-start" /> Option
				</Button>
			</div>
			<div className="rounded-lg border p-5">
				<FieldGroup>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field
							data-invalid={Boolean(
								errors[`options.${selected}.name`],
							)}
						>
							<FieldLabel htmlFor="quotation-option-name">
								Option name
							</FieldLabel>
							<Input
								id="quotation-option-name"
								value={option.name}
								aria-invalid={Boolean(
									errors[`options.${selected}.name`],
								)}
								onChange={(event) =>
									updateOption(selected, (item) => ({
										...item,
										name: event.target.value,
									}))
								}
								placeholder="Cinematic coverage"
							/>
							<FieldError>
								{errors[`options.${selected}.name`]}
							</FieldError>
						</Field>
						<Field
							orientation="horizontal"
							className="self-end rounded-md border p-3"
						>
							<Checkbox
								id="quotation-option-recommended"
								checked={option.isRecommended}
								onCheckedChange={(checked) =>
									change({
										...draft,
										options: draft.options.map(
											(item, index) => ({
												...item,
												isRecommended:
													index === selected
														? checked === true
														: checked
															? false
															: item.isRecommended,
											}),
										),
									})
								}
							/>
							<FieldLabel htmlFor="quotation-option-recommended">
								Recommended
							</FieldLabel>
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor="quotation-option-description">
							Description
						</FieldLabel>
						<Textarea
							id="quotation-option-description"
							value={option.description ?? ""}
							onChange={(event) =>
								updateOption(selected, (item) => ({
									...item,
									description: event.target.value,
								}))
							}
						/>
					</Field>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field
							data-invalid={Boolean(
								errors[`options.${selected}.discountAmount`],
							)}
						>
							<FieldLabel htmlFor="quotation-option-discount">
								Discount amount
							</FieldLabel>
							<Input
								id="quotation-option-discount"
								type="number"
								min="0"
								step="0.01"
								value={option.discountAmount}
								aria-invalid={Boolean(
									errors[
										`options.${selected}.discountAmount`
									],
								)}
								onChange={(event) =>
									updateOption(selected, (item) => ({
										...item,
										discountAmount: event.target.value,
									}))
								}
							/>
							<FieldError>
								{errors[`options.${selected}.discountAmount`]}
							</FieldError>
						</Field>
						<Field
							data-invalid={Boolean(
								errors[`options.${selected}.taxAmount`],
							)}
						>
							<FieldLabel htmlFor="quotation-option-tax">
								Tax amount
							</FieldLabel>
							<Input
								id="quotation-option-tax"
								type="number"
								min="0"
								step="0.01"
								value={option.taxAmount}
								aria-invalid={Boolean(
									errors[`options.${selected}.taxAmount`],
								)}
								onChange={(event) =>
									updateOption(selected, (item) => ({
										...item,
										taxAmount: event.target.value,
									}))
								}
							/>
							<FieldError>
								{errors[`options.${selected}.taxAmount`]}
							</FieldError>
						</Field>
					</div>
				</FieldGroup>
			</div>
			<div
				id="quotation-option-lineitems"
				tabIndex={-1}
				aria-invalid={Boolean(errors[`options.${selected}.lineItems`])}
				className="flex flex-col gap-3"
			>
				<div className="flex items-center justify-between">
					<h3 className="font-medium">Line items</h3>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() =>
							updateOption(selected, (item) => ({
								...item,
								lineItems: [
									...item.lineItems,
									{
										type: "service",
										description: "",
										quantity: "1",
										unitPrice: "0.00",
									},
								],
							}))
						}
					>
						<PlusIcon data-icon="inline-start" /> Line
					</Button>
				</div>
				{option.lineItems.map((line, lineIndex) => (
					<div
						key={lineIndex}
						className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[9rem_1fr_7rem_8rem_auto]"
					>
						<Select
							value={line.type}
							onValueChange={(type: LineType) =>
								updateLine(lineIndex, (current) =>
									type === "item" || type === "service"
										? {
												type,
												description:
													current.description,
												quantity: "1",
												unitPrice: "0.00",
											}
										: {
												type,
												description:
													current.description,
												amount: "0.00",
											},
								)
							}
						>
							<SelectTrigger
								aria-label={`Line ${lineIndex + 1} type`}
								className="w-full"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectLabel>Itemized</SelectLabel>
									<SelectItem value="item">Item</SelectItem>
									<SelectItem value="service">
										Service
									</SelectItem>
								</SelectGroup>
								<SelectGroup>
									<SelectLabel>Lump sum</SelectLabel>
									<SelectItem value="milestone">
										Milestone
									</SelectItem>
									<SelectItem value="expense">
										Expense
									</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
						<Input
							aria-label={`Line ${lineIndex + 1} description`}
							value={line.description}
							placeholder="Description"
							onChange={(event) =>
								updateLine(lineIndex, (current) => ({
									...current,
									description: event.target.value,
								}))
							}
						/>
						{line.type === "item" || line.type === "service" ? (
							<>
								<Input
									aria-label="Quantity"
									type="number"
									min="0.01"
									step="0.01"
									value={line.quantity}
									onChange={(event) =>
										updateLine(lineIndex, (current) =>
											current.type === "item" ||
											current.type === "service"
												? {
														...current,
														quantity:
															event.target.value,
													}
												: current,
										)
									}
								/>
								<Input
									aria-label="Unit price"
									type="number"
									min="0"
									step="0.01"
									value={line.unitPrice}
									onChange={(event) =>
										updateLine(lineIndex, (current) =>
											current.type === "item" ||
											current.type === "service"
												? {
														...current,
														unitPrice:
															event.target.value,
													}
												: current,
										)
									}
								/>
							</>
						) : (
							<>
								<div />
								<Input
									aria-label="Amount"
									type="number"
									min="0"
									step="0.01"
									value={"amount" in line ? line.amount : ""}
									onChange={(event) =>
										updateLine(lineIndex, (current) =>
											current.type === "milestone" ||
											current.type === "expense"
												? {
														...current,
														amount: event.target
															.value,
													}
												: current,
										)
									}
								/>
							</>
						)}
						<Button
							type="button"
							size="icon"
							variant="ghost"
							disabled={option.lineItems.length === 1}
							onClick={() =>
								updateOption(selected, (item) => ({
									...item,
									lineItems: item.lineItems.filter(
										(_, index) => index !== lineIndex,
									),
								}))
							}
							aria-label="Remove line item"
						>
							<Trash2Icon />
						</Button>
					</div>
				))}
				<div className="flex justify-end text-lg font-semibold tabular-nums">
					Preview total&nbsp; {draft.currency}{" "}
					{Number.isFinite(optionTotal(option))
						? optionTotal(option).toFixed(2)
						: "Invalid"}
				</div>
				<FieldError>
					{errors[`options.${selected}.lineItems`]}
				</FieldError>
			</div>
			{draft.options.length > 1 && (
				<Button
					type="button"
					variant="destructive"
					onClick={() => {
						change({
							...draft,
							options: draft.options.filter(
								(_, index) => index !== selected,
							),
						});
						setSelected(Math.max(0, selected - 1));
					}}
				>
					Remove this option
				</Button>
			)}
		</>
	);
}
