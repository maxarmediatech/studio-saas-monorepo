import { addCheckinLink } from "./procedures/add-checkin-link";
import { createCheckin } from "./procedures/create-checkin";
import { createCheckinType } from "./procedures/create-checkin-type";
import { createComment } from "./procedures/create-comment";
import { deleteCheckin } from "./procedures/delete-checkin";
import { deleteCheckinType } from "./procedures/delete-checkin-type";
import { deleteComment } from "./procedures/delete-comment";
import { getCheckin } from "./procedures/get-checkin";
import { getCheckinType } from "./procedures/get-checkin-type";
import { listCheckinTypes } from "./procedures/list-checkin-types";
import { listCheckins } from "./procedures/list-checkins";
import { listComments } from "./procedures/list-comments";
import { listUserCheckins } from "./procedures/list-user-checkins";
import { removeCheckinLink } from "./procedures/remove-checkin-link";
import { updateCheckin } from "./procedures/update-checkin";
import { updateCheckinType } from "./procedures/update-checkin-type";
import { updateComment } from "./procedures/update-comment";

export const checkinsRouter = {
	createType: createCheckinType,
	listTypes: listCheckinTypes,
	getType: getCheckinType,
	updateType: updateCheckinType,
	deleteType: deleteCheckinType,
	createCheckin,
	listCheckins,
	getCheckin,
	updateCheckin,
	deleteCheckin,
	createComment,
	listComments,
	updateComment,
	deleteComment,
	addLink: addCheckinLink,
	removeLink: removeCheckinLink,
	listUserCheckins,
};
