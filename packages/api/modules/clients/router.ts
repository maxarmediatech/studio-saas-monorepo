import { listClients } from "./procedures/list-clients";
import { getClient } from "./procedures/get-client";
import { createClient } from "./procedures/create-client";
import { updateClient } from "./procedures/update-client";
import { deleteClient } from "./procedures/delete-client";
import { getClientStats } from "./procedures/get-client-stats";

export const clientsRouter = {
	list: listClients,
	get: getClient,
	create: createClient,
	update: updateClient,
	delete: deleteClient,
	stats: getClientStats,
};
