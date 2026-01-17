import { addParticipant } from "./procedures/add-participant";
import { createBooking } from "./procedures/create-booking";
import { deleteBooking } from "./procedures/delete-booking";
import { getBooking } from "./procedures/get-booking";
import { getBookingStats } from "./procedures/get-booking-stats";
import { listBookings } from "./procedures/list-bookings";
import { listBookingsMinimal } from "./procedures/list-bookings-minimal";
import { listBookingCrews } from "./procedures/list-crews";
import { listParticipants } from "./procedures/list-participants";
import { removeParticipant } from "./procedures/remove-participant";
import { updateBooking } from "./procedures/update-booking";
import { updateBookingStatus } from "./procedures/update-booking-status";
import { updateParticipant } from "./procedures/update-participant";

export const bookingsRouter = {
	list: listBookings,
	listMinimal: listBookingsMinimal,
	get: getBooking,
	create: createBooking,
	update: updateBooking,
	delete: deleteBooking,
	stats: getBookingStats,
	updateStatus: updateBookingStatus,
	// Participants
	listParticipants: listParticipants,
	addParticipant: addParticipant,
	updateParticipant: updateParticipant,
	removeParticipant: removeParticipant,
	// Crews (aggregated from shoots, tasks, deliverables)
	listCrews: listBookingCrews,
};
