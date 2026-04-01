import { createRole } from "./procedures/create-role";
import { deleteRole } from "./procedures/delete-role";
import { bulkCreateInvitations } from "./procedures/bulk-create-invitations";
import { generateOrganizationSlug } from "./procedures/generate-organization-slug";
import { listRoles } from "./procedures/list-roles";
import { listTeamMembers } from "./procedures/list-team-members";
import { updateRole } from "./procedures/update-role";

export const organizationsRouter = {
	generateSlug: generateOrganizationSlug,
	invites: {
		bulkCreate: bulkCreateInvitations,
	},
	roles: {
		list: listRoles,
		create: createRole,
		update: updateRole,
		delete: deleteRole,
	},
	teams: {
		listMembers: listTeamMembers,
	},
};
