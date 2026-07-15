import type { Client } from "pg";

export async function executeSanitizer(
	client: Client,
	sanitizationKey: string,
	statements: string[],
): Promise<void> {
	for (const statement of statements) {
		await client.query(
			statement,
			statement.includes("$1") ? [sanitizationKey] : [],
		);
	}
}

export const fakeHash = (namespace: string, idExpression = "id") =>
	`md5($1 || ':${namespace}:' || ${idExpression}::text)`;

export const fakePhone = (namespace: string, idExpression = "id") =>
	`'+1999' || left(translate(${fakeHash(namespace, idExpression)}, 'abcdef', '123456'), 8)`;
