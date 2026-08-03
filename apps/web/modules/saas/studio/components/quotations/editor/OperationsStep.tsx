import { DeliverablesEditor } from "./DeliverablesEditor";
import { EditorHeading } from "./EditorHeading";
import { EventsEditor } from "./EventsEditor";
import { PaymentSchedulesEditor } from "./PaymentSchedulesEditor";
import { ShootsEditor } from "./ShootsEditor";
import type {
	BookingDraft,
	ConfigurationOption,
	CrewOption,
	OptionDraft,
} from "./types";

export function OperationsStep({
	option,
	update,
	eventTypes,
	crews,
	organizationTimezone,
	paymentError,
	errors,
	optionIndex,
}: {
	option: OptionDraft;
	update: (booking: BookingDraft) => void;
	eventTypes: ConfigurationOption[];
	crews: CrewOption[];
	organizationTimezone: string;
	paymentError?: string;
	errors: Record<string, string>;
	optionIndex: number;
}) {
	const booking = option.bookingBlueprint.booking;
	return (
		<>
			<EditorHeading
				title="Operational blueprint"
				description="Events, production, delivery and collection plan for this option."
			/>
			<EventsEditor
				booking={booking}
				eventTypes={eventTypes}
				organizationTimezone={organizationTimezone}
				error={errors[`options.${optionIndex}.events`]}
				onChange={update}
			/>
			<ShootsEditor
				booking={booking}
				eventTypes={eventTypes}
				crews={crews}
				onChange={update}
				error={errors[`options.${optionIndex}.shoots`]}
			/>
			<DeliverablesEditor
				booking={booking}
				crews={crews}
				onChange={update}
				error={errors[`options.${optionIndex}.deliverables`]}
			/>
			<PaymentSchedulesEditor
				booking={booking}
				onChange={update}
				error={paymentError}
			/>
		</>
	);
}
