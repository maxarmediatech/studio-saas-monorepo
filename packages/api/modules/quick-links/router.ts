import { createQuickLink } from "./procedures/create";
import { deleteQuickLink } from "./procedures/delete";
import { listQuickLinks } from "./procedures/list";
import { updateQuickLink } from "./procedures/update";

export const quickLinksRouter = {
	list: listQuickLinks,
	create: createQuickLink,
	update: updateQuickLink,
	delete: deleteQuickLink,
};
