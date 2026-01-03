import { assignCrewToTask } from "./procedures/assign-crew";
import { createTask } from "./procedures/create-task";
import { deleteTask } from "./procedures/delete-task";
import { getTask } from "./procedures/get-task";
import { getTaskStats } from "./procedures/get-task-stats";
import { listTasks } from "./procedures/list-tasks";
import { submitTask } from "./procedures/submit-task";
import { unassignCrewFromTask } from "./procedures/unassign-crew";
import { updateTask } from "./procedures/update-task";
import { updateTaskStatus } from "./procedures/update-task-status";

export const tasksRouter = {
	list: listTasks,
	get: getTask,
	create: createTask,
	update: updateTask,
	delete: deleteTask,
	stats: getTaskStats,
	assign: assignCrewToTask,
	unassign: unassignCrewFromTask,
	updateStatus: updateTaskStatus,
	submit: submitTask,
};
