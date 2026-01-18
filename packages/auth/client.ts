import {
	adminClient,
	apiKeyClient,
	inferAdditionalFields,
	inferOrgAdditionalFields,
	magicLinkClient,
	organizationClient,
	twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from ".";
import { ac, appRoles } from "./lib/permissions";

export const authClient = createAuthClient({
	plugins: [
		inferAdditionalFields<typeof auth>(),
		magicLinkClient(),
		organizationClient({
			ac,
			roles: appRoles,
			dynamicAccessControl: {
				enabled: true,
			},
			schema: inferOrgAdditionalFields<typeof auth>(),
		}),
		adminClient(),
		apiKeyClient(),
		twoFactorClient(),
	],
});

export type AuthClientErrorCodes = typeof authClient.$ERROR_CODES & {
	INVALID_INVITATION: string;
};
