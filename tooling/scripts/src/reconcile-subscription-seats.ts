import { updateSeatsInOrganizationSubscription } from "@repo/auth/lib/organization";
import { db, organizations } from "@repo/database";

async function main() {
	const rows = await db.select({ id: organizations.id }).from(organizations);
	const summary = { synced: 0, skipped: 0, failed: 0 };

	for (const organization of rows) {
		const result = await updateSeatsInOrganizationSubscription(
			organization.id,
		);
		summary[result.status] += 1;
	}

	console.log(JSON.stringify(summary));
	if (summary.failed > 0) {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
