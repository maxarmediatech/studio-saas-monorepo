import { assignCrew } from "./procedures/assign-crew";
import { createShoot } from "./procedures/create-shoot";
import { deleteShoot } from "./procedures/delete-shoot";
import { getShoot } from "./procedures/get-shoot";
import { getShootStats } from "./procedures/get-shoot-stats";
import { listShoots } from "./procedures/list-shoots";
import { listShootsMinimal } from "./procedures/list-shoots-minimal";
import { unassignCrew } from "./procedures/unassign-crew";
import { updateShoot } from "./procedures/update-shoot";

export const shootsRouter = {
	list: listShoots,
	listMinimal: listShootsMinimal,
	get: getShoot,
	create: createShoot,
	update: updateShoot,
	delete: deleteShoot,
	stats: getShootStats,
	assign: assignCrew,
	unassign: unassignCrew,
};
