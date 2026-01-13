import { createSticky } from "./procedures/create";
import { deleteSticky } from "./procedures/delete";
import { listStickies } from "./procedures/list";
import { updateSticky } from "./procedures/update";

export const stickiesRouter = {
	list: listStickies,
	create: createSticky,
	update: updateSticky,
	delete: deleteSticky,
};
