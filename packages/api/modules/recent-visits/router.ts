import { listRecentVisits } from "./procedures/list-recent-visits";
import { trackVisit } from "./procedures/track-visit";

export const recentVisitsRouter = {
	list: listRecentVisits,
	track: trackVisit,
};
