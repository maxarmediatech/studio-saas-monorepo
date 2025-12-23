import { listDeliverables } from "./procedures/list-deliverables";
import { listDeliverablesMinimal } from "./procedures/list-deliverables-minimal";
import { getDeliverable } from "./procedures/get-deliverable";
import { createDeliverable } from "./procedures/create-deliverable";
import { updateDeliverable } from "./procedures/update-deliverable";
import { deleteDeliverable } from "./procedures/delete-deliverable";
import { getDeliverableStats } from "./procedures/get-deliverable-stats";
import { assignCrewToDeliverable } from "./procedures/assign-crew";
import { unassignCrewFromDeliverable } from "./procedures/unassign-crew";
import { convertDeliverableToTask } from "./procedures/convert-to-task";
import { submitDeliverable } from "./procedures/submit-deliverable";

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
	submit: submitDeliverable,
};
