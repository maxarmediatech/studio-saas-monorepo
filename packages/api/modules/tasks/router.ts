import { listTasks } from "./procedures/list-tasks";
import { getTask } from "./procedures/get-task";
import { createTask } from "./procedures/create-task";
import { updateTask } from "./procedures/update-task";
import { deleteTask } from "./procedures/delete-task";
import { getTaskStats } from "./procedures/get-task-stats";
import { assignCrewToTask } from "./procedures/assign-crew";
import { unassignCrewFromTask } from "./procedures/unassign-crew";
import { updateTaskStatus } from "./procedures/update-task-status";
import { submitTask } from "./procedures/submit-task";

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
