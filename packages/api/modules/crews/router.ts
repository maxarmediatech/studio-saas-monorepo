import { listCrews } from "./procedures/list-crews";
import { getCrew } from "./procedures/get-crew";
import { createCrew } from "./procedures/create-crew";
import { updateCrew } from "./procedures/update-crew";
import { deleteCrew } from "./procedures/delete-crew";
import { getCrewAvailability } from "./procedures/get-crew-availability";
import { createCrewFromMember } from "./procedures/create-crew-from-member";

export const crewsRouter = {
	list: listCrews,
	get: getCrew,
	create: createCrew,
	update: updateCrew,
	delete: deleteCrew,
	availability: getCrewAvailability,
	createFromMember: createCrewFromMember,
};
