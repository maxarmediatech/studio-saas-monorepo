import crypto from "node:crypto";
import { decryptToken, encryptToken } from "@repo/google-calendar";

const ENCRYPTED_TOKEN_PREFIX = "v1:";

export const encryptWhatsAppSecret = (value: string) => encryptToken(value);

export const decryptWhatsAppSecret = (value?: string | null) => {
	if (!value) {
		return null;
	}

	if (!value.startsWith(ENCRYPTED_TOKEN_PREFIX)) {
		return value;
	}

	return decryptToken(value);
};

export const hashWebhookVerifyToken = (token: string) =>
	crypto.createHash("sha256").update(token).digest("hex");
