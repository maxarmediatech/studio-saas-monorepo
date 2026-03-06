import process from "node:process";
import {
	and,
	crews,
	db,
	eq,
	inArray,
	invitations,
	isNotNull,
	isNull,
	members,
	organizationRoles,
} from "./index";

const ORGANIZATION_ADMIN_ROLES = new Set(["owner", "admin"]);
const PROFILE_ONLY_ROLES = new Set(["crew"]);
const ROLE_PATTERN = /^[a-z][a-z0-9_]*$/;

function normalizeRoles(value: string | null | undefined): string[] {
	if (!value) {
		return [];
	}

	const roles: string[] = [];
	const seen = new Set<string>();

	const tryParseJsonArray = (input: string): string[] | null => {
		let candidate = input.trim();
		if (!candidate) {
			return null;
		}

		for (let attempt = 0; attempt < 2; attempt += 1) {
			try {
				const parsed = JSON.parse(candidate) as unknown;
				if (Array.isArray(parsed)) {
					return parsed.filter(
						(entry): entry is string => typeof entry === "string",
					);
				}
				if (typeof parsed === "string") {
					const nested = parsed.trim();
					if (nested.startsWith("[")) {
						candidate = nested;
						continue;
					}
					return [parsed];
				}
			} catch {
				// Ignore malformed JSON and fall back to comma splitting.
			}
			break;
		}

		return null;
	};

	const parsedRoles = tryParseJsonArray(value);
	const parts = parsedRoles ?? value.split(",");

	for (const part of parts) {
		const trimmed = part.trim().toLowerCase();
		const cleaned = trimmed.replace(/^[^a-z0-9_]+|[^a-z0-9_]+$/g, "");
		if (!cleaned || !ROLE_PATTERN.test(cleaned)) {
			continue;
		}
		if (seen.has(cleaned)) {
			continue;
		}
		seen.add(cleaned);
		roles.push(cleaned);
	}

	return roles;
}

function coerceOrganizationRoles(value: string | null | undefined): string[] {
	const roles = normalizeRoles(value).filter(
		(role) => !PROFILE_ONLY_ROLES.has(role),
	);

	if (roles.length === 0) {
		return ["member"];
	}

	const hasOrganizationAdminRole = roles.some((role) =>
		ORGANIZATION_ADMIN_ROLES.has(role),
	);
	if (hasOrganizationAdminRole) {
		return roles;
	}

	return roles.includes("member") ? roles : ["member", ...roles];
}

function serializeOrganizationRoles(value: string | null | undefined): string {
	return coerceOrganizationRoles(value).join(",");
}

async function cleanupOrganizationRoleDefinitions() {
	const deleted = await db
		.delete(organizationRoles)
		.where(inArray(organizationRoles.role, ["crew"]))
		.returning({ id: organizationRoles.id });

	return deleted.length;
}

async function cleanupMemberRoles() {
	const rows = await db.query.members.findMany({
		columns: { id: true, role: true },
	});

	let updated = 0;
	for (const row of rows) {
		const nextRole = serializeOrganizationRoles(row.role);
		if (nextRole === row.role) {
			continue;
		}

		await db
			.update(members)
			.set({ role: nextRole })
			.where(eq(members.id, row.id));
		updated += 1;
	}

	return { scanned: rows.length, updated };
}

async function cleanupInvitationRoles() {
	const rows = await db.query.invitations.findMany({
		columns: { id: true, role: true },
	});

	let updated = 0;
	for (const row of rows) {
		const nextRole = serializeOrganizationRoles(row.role);
		if (nextRole === row.role) {
			continue;
		}

		await db
			.update(invitations)
			.set({ role: nextRole })
			.where(eq(invitations.id, row.id));
		updated += 1;
	}

	return { scanned: rows.length, updated };
}

async function backfillCrewProfiles() {
	const existingCrewRows = await db.query.crews.findMany({
		where: and(isNotNull(crews.userId), isNull(crews.deletedAt)),
		columns: { organizationId: true, userId: true },
	});
	const existingKeys = new Set(
		existingCrewRows
			.filter((row) => Boolean(row.userId))
			.map((row) => `${row.organizationId}:${row.userId}`),
	);

	const memberRows = await db.query.members.findMany({
		columns: {
			id: true,
			organizationId: true,
			userId: true,
		},
		with: {
			user: {
				columns: { id: true, name: true, email: true },
			},
		},
	});

	let created = 0;
	let skippedExisting = 0;
	let skippedMissingUser = 0;

	for (const member of memberRows) {
		const user = member.user;
		if (!user) {
			skippedMissingUser += 1;
			continue;
		}

		const key = `${member.organizationId}:${member.userId}`;
		if (existingKeys.has(key)) {
			skippedExisting += 1;
			continue;
		}

		const [inserted] = await db
			.insert(crews)
			.values({
				organizationId: member.organizationId,
				userId: user.id,
				name: user.name,
				email: user.email,
				phoneNumber: null,
				status: "active",
				dailyRate: null,
				metadata: {
					autoCreated: true,
					backfilledBy: "backfill-crew-role-cleanup",
				},
				createdBy: user.id,
			})
			.onConflictDoNothing()
			.returning({ id: crews.id });

		if (inserted) {
			created += 1;
			existingKeys.add(key);
			continue;
		}

		skippedExisting += 1;
		existingKeys.add(key);
	}

	return {
		scanned: memberRows.length,
		created,
		skippedExisting,
		skippedMissingUser,
	};
}

async function main() {
	console.info("Starting crew-role cleanup and crew profile backfill...");

	const deletedRoleDefinitions = await cleanupOrganizationRoleDefinitions();
	const memberCleanup = await cleanupMemberRoles();
	const invitationCleanup = await cleanupInvitationRoles();
	const crewBackfill = await backfillCrewProfiles();

	console.info("Cleanup summary:");
	console.info(`- organization_roles deleted: ${deletedRoleDefinitions}`);
	console.info(
		`- members scanned: ${memberCleanup.scanned}, updated: ${memberCleanup.updated}`,
	);
	console.info(
		`- invitations scanned: ${invitationCleanup.scanned}, updated: ${invitationCleanup.updated}`,
	);
	console.info(
		`- crew backfill scanned: ${crewBackfill.scanned}, created: ${crewBackfill.created}, existing: ${crewBackfill.skippedExisting}, missing users: ${crewBackfill.skippedMissingUser}`,
	);
	console.info("Done.");
}

main().catch((error) => {
	console.error("Cleanup failed:", error);
	process.exitCode = 1;
});
