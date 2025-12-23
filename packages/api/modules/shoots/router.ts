import { listShoots } from "./procedures/list-shoots";
import { listShootsMinimal } from "./procedures/list-shoots-minimal";
import { getShoot } from "./procedures/get-shoot";
import { createShoot } from "./procedures/create-shoot";
import { updateShoot } from "./procedures/update-shoot";
import { deleteShoot } from "./procedures/delete-shoot";
import { getShootStats } from "./procedures/get-shoot-stats";
import { assignCrew } from "./procedures/assign-crew";
import { unassignCrew } from "./procedures/unassign-crew";

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
