import crypto from "node:crypto";

export const decryptWhatsAppStoredSecret = (value: string) => {
	if (!value.startsWith("v1:")) {
		return value;
	}

	const rawKey = process.env.INTEGRATIONS_TOKEN_ENCRYPTION_KEY;
	if (!rawKey) {
		throw new Error("Missing INTEGRATIONS_TOKEN_ENCRYPTION_KEY");
	}

	const key = Buffer.from(rawKey, "base64");
	if (key.length !== 32) {
		throw new Error(
			"INTEGRATIONS_TOKEN_ENCRYPTION_KEY must be 32 bytes (base64-encoded)",
		);
	}

	const parts = value.split(":");
	if (parts.length !== 4 || parts[0] !== "v1") {
		throw new Error("Invalid encrypted token format");
	}

	const decipher = crypto.createDecipheriv(
		"aes-256-gcm",
		key,
		Buffer.from(parts[1], "base64"),
	);
	decipher.setAuthTag(Buffer.from(parts[3], "base64"));
	return Buffer.concat([
		decipher.update(Buffer.from(parts[2], "base64")),
		decipher.final(),
	]).toString("utf8");
};
