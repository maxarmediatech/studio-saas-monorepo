/**
 * Configurations Router
 *
 * Manages per-organization customizable settings like statuses, priorities, and categories.
 */

import { createConfiguration } from "./procedures/create-configuration";
import { deleteConfiguration } from "./procedures/delete-configuration";
import { getConfiguration } from "./procedures/get-configuration";
import { listConfigurations } from "./procedures/list-configurations";
import { seedConfigurations } from "./procedures/seed-configurations";
import { updateConfiguration } from "./procedures/update-configuration";

export const configurationsRouter = {
	list: listConfigurations,
	get: getConfiguration,
	create: createConfiguration,
	update: updateConfiguration,
	delete: deleteConfiguration,
	seed: seedConfigurations,
};
