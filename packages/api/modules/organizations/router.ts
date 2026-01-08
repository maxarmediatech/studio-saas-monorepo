import { generateOrganizationSlug } from "./procedures/generate-organization-slug";

// Logo upload moved to /api/uploads/presigned-url
export const organizationsRouter = {
	generateSlug: generateOrganizationSlug,
};
