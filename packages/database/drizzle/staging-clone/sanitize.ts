import type { Client } from "pg";
import { sanitizeAuth } from "./sanitizers/auth";
import { sanitizeCommunications } from "./sanitizers/communications";
import { sanitizeFinancial } from "./sanitizers/financial";
import { sanitizeIntegrations } from "./sanitizers/integrations";
import { sanitizeOrganizations } from "./sanitizers/organizations";
import { sanitizeStudio } from "./sanitizers/studio";

export async function sanitizeDatabase(
	client: Client,
	sanitizationKey: string,
	stagingAdmin: { email: string; password: string },
): Promise<void> {
	await client.query("BEGIN");
	try {
		await sanitizeAuth(client, sanitizationKey, stagingAdmin);
		await sanitizeOrganizations(client, sanitizationKey);
		await sanitizeStudio(client, sanitizationKey);
		await sanitizeFinancial(client, sanitizationKey);
		await sanitizeCommunications(client, sanitizationKey);
		await sanitizeIntegrations(client, sanitizationKey);
		await client.query("SET CONSTRAINTS ALL IMMEDIATE");
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	}
}
