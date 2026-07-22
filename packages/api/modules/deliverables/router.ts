import { assignCrewToDeliverable } from "./procedures/assign-crew";
import { convertDeliverableToTask } from "./procedures/convert-to-task";
import { createDeliverable } from "./procedures/create-deliverable";
import { deleteDeliverable } from "./procedures/delete-deliverable";
import { getDeliverable } from "./procedures/get-deliverable";
import { getDeliverableStats } from "./procedures/get-deliverable-stats";
import { linkTaskToDeliverable } from "./procedures/link-task";
import { listDeliverables } from "./procedures/list-deliverables";
import { listDeliverablesMinimal } from "./procedures/list-deliverables-minimal";
import { setDeliverableDelivery } from "./procedures/set-delivery";
import { submitDeliverable } from "./procedures/submit-deliverable";
import { unassignCrewFromDeliverable } from "./procedures/unassign-crew";
import { unlinkTaskFromDeliverable } from "./procedures/unlink-task";
import { updateDeliverable } from "./procedures/update-deliverable";
import { updateDeliverableAssignmentStatus } from "./procedures/update-deliverable-assignment-status";

export const deliverablesRouter = {
	list: listDeliverables,
	listMinimal: listDeliverablesMinimal,
	get: getDeliverable,
	create: createDeliverable,
	update: updateDeliverable,
	delete: deleteDeliverable,
	stats: getDeliverableStats,
	assign: assignCrewToDeliverable,
	unassign: unassignCrewFromDeliverable,
	convertToTask: convertDeliverableToTask,
	linkTask: linkTaskToDeliverable,
	unlinkTask: unlinkTaskFromDeliverable,
	setDelivery: setDeliverableDelivery,
	updateAssignmentStatus: updateDeliverableAssignmentStatus,
	submit: submitDeliverable,
};
