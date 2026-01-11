import { createSavedView } from "./procedures/create-saved-view";
import { deleteSavedView } from "./procedures/delete-saved-view";
import { listSavedViews } from "./procedures/list-saved-views";
import { toggleFavorite } from "./procedures/toggle-favorite";
import { updateSavedView } from "./procedures/update-saved-view";

export const savedViewsRouter = {
	list: listSavedViews,
	create: createSavedView,
	update: updateSavedView,
	delete: deleteSavedView,
	toggleFavorite: toggleFavorite,
};
