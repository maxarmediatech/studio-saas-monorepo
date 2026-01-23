import { db, eq, organizationRoles } from "@repo/database";
import { defaultEditableRoles } from "./permissions";

export async function ensureDefaultOrganizationRoles(
	organizationId: string,
): Promise<number> {
	const existingRoles = await db.query.organizationRoles.findMany({
		where: eq(organizationRoles.organizationId, organizationId),
		columns: { role: true },
	});
	const existing = new Set(existingRoles.map((role) => role.role));

	const toInsert = defaultEditableRoles.filter(
		(role) => !existing.has(role.key),
	);

	if (toInsert.length === 0) {
		return 0;
	}

	await db.insert(organizationRoles).values(
		toInsert.map((role) => ({
			organizationId,
			role: role.key,
			permission: JSON.stringify(role.permissions),
			description: role.description,
		})),
	);

	return toInsert.length;
}
