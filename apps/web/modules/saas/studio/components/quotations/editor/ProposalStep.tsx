import type { QuoteDraftContentInput } from "@repo/api/modules/studio/schemas/quote";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@repo/ui/components/empty";
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
import { PlusIcon, Trash2Icon } from "lucide-react";
import {
	isoToOrganizationDate,
	organizationDateToEndOfDayIso,
} from "../quotation-date-helpers";
import { EditorHeading } from "./EditorHeading";
import type { ClientOption, EditorErrors } from "./types";

export function ProposalStep({
	draft,
	patch,
	change,
	clients,
	errors,
	organizationTimezone,
}: {
	draft: QuoteDraftContentInput;
	patch: (value: Partial<QuoteDraftContentInput>) => void;
	change: (value: QuoteDraftContentInput) => void;
	clients: ClientOption[];
	errors: EditorErrors;
	organizationTimezone: string;
}) {
	const participants = draft.participants;
	return (
		<>
			<EditorHeading
				title="Proposal & clients"
				description="Commercial context shared by every option."
			/>
			<FieldGroup className="rounded-lg border p-5">
				<Field data-invalid={Boolean(errors.title)}>
					<FieldLabel htmlFor="quotation-title">
						Quotation title
					</FieldLabel>
					<Input
						id="quotation-title"
						aria-invalid={Boolean(errors.title)}
						value={draft.title}
						onChange={(event) =>
							patch({ title: event.target.value })
						}
						placeholder="Mehta wedding photography proposal"
					/>
					<FieldError>{errors.title}</FieldError>
				</Field>
				<div className="grid gap-4 sm:grid-cols-2">
					<Field data-invalid={Boolean(errors.currency)}>
						<FieldLabel htmlFor="quotation-currency">
							Currency
						</FieldLabel>
						<Input
							id="quotation-currency"
							value={draft.currency}
							maxLength={3}
							aria-invalid={Boolean(errors.currency)}
							onChange={(event) =>
								patch({
									currency: event.target.value.toUpperCase(),
								})
							}
						/>
						<FieldError>{errors.currency}</FieldError>
					</Field>
					<Field data-invalid={Boolean(errors.expiresAt)}>
						<FieldLabel htmlFor="quotation-expiry">
							Expires on
						</FieldLabel>
						<Input
							id="quotation-expiry"
							type="date"
							aria-invalid={Boolean(errors.expiresAt)}
							value={
								draft.expiresAt
									? isoToOrganizationDate(
											draft.expiresAt,
											organizationTimezone,
										)
									: ""
							}
							onChange={(event) =>
								patch({
									expiresAt: event.target.value
										? organizationDateToEndOfDayIso(
												event.target.value,
												organizationTimezone,
											)
										: undefined,
								})
							}
						/>
						<FieldError>{errors.expiresAt}</FieldError>
					</Field>
				</div>
				<Field>
					<FieldLabel htmlFor="quotation-client-message">
						Client message
					</FieldLabel>
					<Textarea
						id="quotation-client-message"
						value={draft.clientMessage ?? ""}
						onChange={(event) =>
							patch({ clientMessage: event.target.value })
						}
						placeholder="A short note shown with the proposal"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="quotation-internal-notes">
						Internal notes
					</FieldLabel>
					<Textarea
						id="quotation-internal-notes"
						value={draft.internalNotes ?? ""}
						onChange={(event) =>
							patch({ internalNotes: event.target.value })
						}
						placeholder="Visible only to studio operators"
					/>
				</Field>
			</FieldGroup>
			{clients.length === 0 ? (
				<Empty className="border py-6">
					<EmptyHeader>
						<EmptyTitle>No active clients</EmptyTitle>
						<EmptyDescription>
							Create a client before saving a quotation. Every
							quotation requires at least one participant.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			<div
				id="quotation-participants"
				tabIndex={-1}
				className="flex flex-col gap-3"
			>
				<div className="flex items-center justify-between">
					<h3 className="font-medium">Participants</h3>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() =>
							change({
								...draft,
								participants: [
									...participants,
									{
										clientId: "",
										role: "",
										isPrimary: false,
									},
								],
							})
						}
					>
						<PlusIcon data-icon="inline-start" /> Participant
					</Button>
				</div>
				{participants.map((participant, index) => (
					<div
						key={`${index}-${participant.clientId}`}
						className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_1fr_auto_auto]"
					>
						<Field data-invalid={Boolean(errors.participants)}>
							<FieldLabel htmlFor={`participant-client-${index}`}>
								Client
							</FieldLabel>
							<Select
								value={participant.clientId || undefined}
								onValueChange={(clientId) => {
									const next = [...participants];
									next[index] = { ...participant, clientId };
									change({ ...draft, participants: next });
								}}
							>
								<SelectTrigger
									id={`participant-client-${index}`}
									className="w-full"
									aria-invalid={Boolean(errors.participants)}
								>
									<SelectValue placeholder="Select client" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectLabel>Clients</SelectLabel>
										{clients
											.filter(
												(client) =>
													client.id ===
														participant.clientId ||
													!participants.some(
														(item, itemIndex) =>
															itemIndex !==
																index &&
															item.clientId ===
																client.id,
													),
											)
											.map((client) => (
												<SelectItem
													key={client.id}
													value={client.id}
												>
													{client.name}
												</SelectItem>
											))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor={`participant-role-${index}`}>
								Role
							</FieldLabel>
							<Input
								id={`participant-role-${index}`}
								value={participant.role}
								onChange={(event) => {
									const next = [...participants];
									next[index] = {
										...participant,
										role: event.target.value,
									};
									change({ ...draft, participants: next });
								}}
								placeholder="Bride, groom, company"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor={`participant-side-${index}`}>
								Side
							</FieldLabel>
							<Input
								id={`participant-side-${index}`}
								value={participant.side ?? ""}
								onChange={(event) => {
									const next = [...participants];
									next[index] = {
										...participant,
										side: event.target.value || undefined,
									};
									change({ ...draft, participants: next });
								}}
								placeholder="Bride, groom, host"
							/>
						</Field>
						<Field className="justify-end">
							<FieldLabel
								htmlFor={`participant-primary-${index}`}
							>
								Primary
							</FieldLabel>
							<Checkbox
								id={`participant-primary-${index}`}
								checked={participant.isPrimary}
								onCheckedChange={(checked) =>
									change({
										...draft,
										participants: participants.map(
											(item, itemIndex) => ({
												...item,
												isPrimary:
													itemIndex === index
														? checked === true
														: checked
															? false
															: item.isPrimary,
											}),
										),
									})
								}
							/>
						</Field>
						<Button
							type="button"
							className="self-end"
							size="icon"
							variant="ghost"
							disabled={participants.length === 1}
							onClick={() =>
								change({
									...draft,
									participants: participants.filter(
										(_, itemIndex) => itemIndex !== index,
									),
								})
							}
							aria-label="Remove participant"
						>
							<Trash2Icon />
						</Button>
					</div>
				))}
				<FieldError>{errors.participants}</FieldError>
			</div>
			<TermsEditor
				terms={draft.terms ?? []}
				onChange={(terms) => patch({ terms })}
				error={errors.terms}
			/>
		</>
	);
}

function TermsEditor({
	terms,
	onChange,
	error,
}: {
	terms: string[];
	onChange: (terms: string[]) => void;
	error?: string;
}) {
	return (
		<div
			id="quotation-terms"
			tabIndex={-1}
			aria-invalid={Boolean(error)}
			className="flex flex-col gap-3"
		>
			<div className="flex items-center justify-between">
				<h3 className="font-medium">Terms</h3>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={() => onChange([...terms, ""])}
				>
					<PlusIcon data-icon="inline-start" /> Term
				</Button>
			</div>
			{terms.length === 0 ? (
				<Empty className="border py-6">
					<EmptyHeader>
						<EmptyTitle>No fixed terms</EmptyTitle>
						<EmptyDescription>
							Add cancellation, delivery, or usage terms when
							needed.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				terms.map((term, index) => (
					<div className="flex gap-2" key={index}>
						<label
							className="sr-only"
							htmlFor={`quotation-term-${index}`}
						>
							Term {index + 1}
						</label>
						<Textarea
							id={`quotation-term-${index}`}
							value={term}
							aria-invalid={Boolean(error)}
							onChange={(event) =>
								onChange(
									terms.map((item, itemIndex) =>
										itemIndex === index
											? event.target.value
											: item,
									),
								)
							}
							placeholder="Cancellation, delivery or usage term"
						/>
						<Button
							type="button"
							size="icon"
							variant="ghost"
							onClick={() =>
								onChange(
									terms.filter(
										(_, itemIndex) => itemIndex !== index,
									),
								)
							}
							aria-label="Remove term"
						>
							<Trash2Icon />
						</Button>
					</div>
				))
			)}
			<FieldError>{error}</FieldError>
		</div>
	);
}
