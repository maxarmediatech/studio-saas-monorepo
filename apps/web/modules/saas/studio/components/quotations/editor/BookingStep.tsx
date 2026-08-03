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
import { ContractAttachmentField } from "./ContractAttachmentField";
import { EditorHeading } from "./EditorHeading";
import type { BookingDraft, ConfigurationOption, OptionDraft } from "./types";

export function BookingStep({
	option,
	update,
	bookingTypes,
	packageTypes,
	onAttachmentUploaded,
	error,
}: {
	option: OptionDraft;
	update: (booking: BookingDraft) => void;
	bookingTypes: ConfigurationOption[];
	packageTypes: ConfigurationOption[];
	onAttachmentUploaded: (key: string) => void;
	error?: string;
}) {
	const booking = option.bookingBlueprint.booking;
	const set = (value: Partial<BookingDraft>) =>
		update({ ...booking, ...value });
	return (
		<>
			<EditorHeading
				title="Booking blueprint"
				description="These fields become the booking without duplicate entry when this option is accepted."
			/>
			{bookingTypes.length === 0 || packageTypes.length === 0 ? (
				<Empty className="border py-6">
					<EmptyHeader>
						<EmptyTitle>Booking configuration required</EmptyTitle>
						<EmptyDescription>
							Add at least one booking type and package type in
							studio configuration before saving.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			<FieldGroup className="rounded-lg border p-5">
				<Field data-invalid={Boolean(error)}>
					<FieldLabel htmlFor="blueprint-booking-name">
						Booking name
					</FieldLabel>
					<Input
						id="blueprint-booking-name"
						value={booking.name}
						aria-invalid={Boolean(error)}
						onChange={(event) => set({ name: event.target.value })}
					/>
					<FieldError>{error}</FieldError>
				</Field>
				<div className="grid gap-4 sm:grid-cols-3">
					<Field>
						<FieldLabel htmlFor="blueprint-booking-date">
							Booking date
						</FieldLabel>
						<Input
							id="blueprint-booking-date"
							type="date"
							value={booking.bookingDate}
							onChange={(event) =>
								set({ bookingDate: event.target.value })
							}
						/>
					</Field>
					<ConfigurationSelect
						label="Booking type"
						groupLabel="Booking types"
						value={booking.bookingType}
						options={bookingTypes}
						onChange={(bookingType) => set({ bookingType })}
					/>
					<ConfigurationSelect
						label="Package type"
						groupLabel="Package types"
						value={booking.packageType}
						options={packageTypes}
						onChange={(packageType) => set({ packageType })}
					/>
				</div>
				<Field>
					<FieldLabel htmlFor="blueprint-booking-note">
						Booking note
					</FieldLabel>
					<Textarea
						id="blueprint-booking-note"
						value={booking.note ?? ""}
						onChange={(event) => set({ note: event.target.value })}
						placeholder="Operational context that belongs on the booking"
					/>
				</Field>
				<ContractAttachmentField
					value={booking.contractAttachment}
					onUploaded={onAttachmentUploaded}
					onChange={(contractAttachment) =>
						set({ contractAttachment })
					}
				/>
			</FieldGroup>
		</>
	);
}

function ConfigurationSelect({
	label,
	groupLabel,
	value,
	options,
	onChange,
}: {
	label: string;
	groupLabel: string;
	value: string;
	options: ConfigurationOption[];
	onChange: (value: string) => void;
}) {
	return (
		<Field>
			<FieldLabel
				htmlFor={`blueprint-${label.replaceAll(" ", "-").toLowerCase()}`}
			>
				{label}
			</FieldLabel>
			<Select value={value || undefined} onValueChange={onChange}>
				<SelectTrigger
					id={`blueprint-${label.replaceAll(" ", "-").toLowerCase()}`}
					className="w-full"
				>
					<SelectValue
						placeholder={`Select ${label.toLowerCase()}`}
					/>
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectLabel>{groupLabel}</SelectLabel>
						{options.map((item) => (
							<SelectItem key={item.key} value={item.key}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
