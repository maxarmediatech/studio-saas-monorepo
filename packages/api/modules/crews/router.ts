import { createCrew } from "./procedures/create-crew";
import { createCrewFromMember } from "./procedures/create-crew-from-member";
import { deleteCrew } from "./procedures/delete-crew";
import { getCrew } from "./procedures/get-crew";
import { getCrewAvailability } from "./procedures/get-crew-availability";
import { listCrews } from "./procedures/list-crews";
import { updateCrew } from "./procedures/update-crew";

export const crewsRouter = {
	list: listCrews,
	get: getCrew,
	create: createCrew,
	update: updateCrew,
	delete: deleteCrew,
	availability: getCrewAvailability,
	createFromMember: createCrewFromMember,
};
