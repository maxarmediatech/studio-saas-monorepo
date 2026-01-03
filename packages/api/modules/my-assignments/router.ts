import { getMyDeliverables } from "./procedures/get-my-deliverables";
import { getMyShoots } from "./procedures/get-my-shoots";
import { getMyTasks } from "./procedures/get-my-tasks";
import { listMyAssignments } from "./procedures/list-my-assignments";

export const myAssignmentsRouter = {
	list: listMyAssignments,
	shoots: getMyShoots,
	tasks: getMyTasks,
	deliverables: getMyDeliverables,
};
