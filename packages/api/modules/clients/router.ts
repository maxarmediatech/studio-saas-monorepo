import { createClient } from "./procedures/create-client";
import { deleteClient } from "./procedures/delete-client";
import { getClient } from "./procedures/get-client";
import { getClientStats } from "./procedures/get-client-stats";
import { listClients } from "./procedures/list-clients";
import { updateClient } from "./procedures/update-client";

export const clientsRouter = {
	list: listClients,
	get: getClient,
	create: createClient,
	update: updateClient,
	delete: deleteClient,
	stats: getClientStats,
};
