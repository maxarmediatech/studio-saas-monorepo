import type { ActiveOrganization } from "../auth";
import { hasAnyRole } from "./permissions";

export function isOrganizationAdmin(
	organization?: ActiveOrganization | null,
	user?: {
		id: string;
		role?: string | null;
	} | null,
) {
	const userOrganizationRole = organization?.members.find(
		(member) => member.userId === user?.id,
	)?.role;

	return (
		hasAnyRole(userOrganizationRole ?? undefined, ["owner", "admin"]) ||
		user?.role === "admin"
	);
}
