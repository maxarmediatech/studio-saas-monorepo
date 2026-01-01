import { listBookings } from "./procedures/list-bookings";
import { listBookingsMinimal } from "./procedures/list-bookings-minimal";
import { getBooking } from "./procedures/get-booking";
import { createBooking } from "./procedures/create-booking";
import { updateBooking } from "./procedures/update-booking";
import { deleteBooking } from "./procedures/delete-booking";
import { getBookingStats } from "./procedures/get-booking-stats";
import { updateBookingStatus } from "./procedures/update-booking-status";
import { listParticipants } from "./procedures/list-participants";
import { addParticipant } from "./procedures/add-participant";
import { updateParticipant } from "./procedures/update-participant";
import { removeParticipant } from "./procedures/remove-participant";

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
};
