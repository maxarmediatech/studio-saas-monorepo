import { getDashboard } from "./procedures/get-dashboard";
import { getKpis } from "./procedures/get-kpis";
import { getOperations } from "./procedures/get-operations";
import { getQuickActions } from "./procedures/get-quick-actions";

export const dashboardRouter = {
	get: getDashboard,
	kpis: getKpis,
	operations: getOperations,
	actions: getQuickActions,
};
