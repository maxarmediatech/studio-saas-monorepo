import { randomBytes, randomUUID, scrypt } from "node:crypto";
import type { Client } from "pg";
import { executeSanitizer, fakeHash } from "./helpers";

export const CLEARED_AUTH_TABLES = [
	"sessions",
	"two_factors",
	"verifications",
] as const;

export const ROW_COUNT_MUTABLE_AUTH_TABLES = [
	...CLEARED_AUTH_TABLES,
	"accounts",
] as const;

export async function hashStagingPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString("hex");
	const normalizedPassword = password.normalize("NFKC");
	const key = await new Promise<Buffer>((resolve, reject) => {
		scrypt(
			normalizedPassword,
			salt,
			64,
			{ N: 16_384, r: 16, p: 1, maxmem: 128 * 16_384 * 16 * 2 },
			(error, derivedKey) => {
				if (error) {
					reject(error);
					return;
				}
				resolve(derivedKey);
			},
		);
	});
	return `${salt}:${key.toString("hex")}`;
}

export async function sanitizeAuth(
	client: Client,
	sanitizationKey: string,
	stagingAdmin: { email: string; password: string },
): Promise<void> {
	await executeSanitizer(client, sanitizationKey, [
		"TRUNCATE TABLE sessions, two_factors, verifications",
		`UPDATE users SET
			name = 'User ' || left(${fakeHash("user")}, 10),
			email = 'user+' || ${fakeHash("user-email")} || '@example.invalid',
			image = NULL,
			username = CASE WHEN username IS NULL THEN NULL ELSE 'user_' || left(${fakeHash("username")}, 20) END,
			display_username = CASE WHEN display_username IS NULL THEN NULL ELSE 'User ' || left(${fakeHash("display-username")}, 10) END,
			ban_reason = NULL,
			payments_customer_id = CASE WHEN payments_customer_id IS NULL THEN NULL ELSE 'cus_sanitized_' || ${fakeHash("user-customer")} END`,
		`UPDATE accounts SET
			account_id = 'account_' || ${fakeHash("auth-account")},
			access_token = NULL,
			refresh_token = NULL,
			id_token = NULL,
			password = NULL,
			scope = NULL,
			expires_at = NULL,
			access_token_expires_at = NULL,
			refresh_token_expires_at = NULL`,
	]);

	const owner = await client.query<{ id: string }>(`
		SELECT users.id
		FROM users
		JOIN members ON members.user_id = users.id
		ORDER BY
			CASE WHEN members.role LIKE '%owner%' THEN 0 ELSE 1 END,
			members.created_at,
			members.id
		LIMIT 1
	`);
	const ownerId = owner.rows[0]?.id;
	if (!ownerId) {
		throw new Error(
			"Cannot create staging login because no organization member exists",
		);
	}

	await client.query(
		`UPDATE users SET
			name = 'Staging Admin',
			email = $1,
			email_verified = true,
			username = 'staging_admin',
			display_username = 'Staging Admin',
			onboarding_complete = true,
			banned = false,
			ban_reason = NULL,
			ban_expires = NULL
		WHERE id = $2`,
		[stagingAdmin.email, ownerId],
	);

	const account = await client.query<{ id: string }>(
		`SELECT id FROM accounts
		WHERE user_id = $1
		ORDER BY CASE WHEN provider_id = 'credential' THEN 0 ELSE 1 END, created_at, id
		LIMIT 1`,
		[ownerId],
	);
	const passwordHash = await hashStagingPassword(stagingAdmin.password);
	if (account.rows[0]) {
		await client.query(
			`UPDATE accounts SET
				account_id = $1,
				provider_id = 'credential',
				password = $2,
				updated_at = now()
			WHERE id = $3`,
			[ownerId, passwordHash, account.rows[0].id],
		);
	} else {
		await client.query(
			`INSERT INTO accounts (
				id, account_id, provider_id, user_id, password, created_at, updated_at
			) VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
			[randomUUID(), ownerId, passwordHash],
		);
	}
}
