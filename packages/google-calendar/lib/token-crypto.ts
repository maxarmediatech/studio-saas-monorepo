import crypto from "node:crypto";

export function requireTokenEncryptionKey(): Buffer {
	const raw = process.env.INTEGRATIONS_TOKEN_ENCRYPTION_KEY;
	if (!raw) {
		throw new Error("Missing INTEGRATIONS_TOKEN_ENCRYPTION_KEY");
	}

	const key = Buffer.from(raw, "base64");
	if (key.length !== 32) {
		throw new Error(
			"INTEGRATIONS_TOKEN_ENCRYPTION_KEY must be 32 bytes (base64-encoded)",
		);
	}

	return key;
}

export function encryptToken(plaintext: string): string {
	const key = requireTokenEncryptionKey();
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
	const ciphertext = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return [
		"v1",
		iv.toString("base64"),
		ciphertext.toString("base64"),
		tag.toString("base64"),
	].join(":");
}

export function decryptToken(encrypted: string): string {
	const key = requireTokenEncryptionKey();
	const parts = encrypted.split(":");
	if (parts.length !== 4 || parts[0] !== "v1") {
		throw new Error("Invalid encrypted token format");
	}

	const iv = Buffer.from(parts[1], "base64");
	const ciphertext = Buffer.from(parts[2], "base64");
	const tag = Buffer.from(parts[3], "base64");

	const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
	decipher.setAuthTag(tag);
	const plaintext = Buffer.concat([
		decipher.update(ciphertext),
		decipher.final(),
	]);
	return plaintext.toString("utf8");
}
