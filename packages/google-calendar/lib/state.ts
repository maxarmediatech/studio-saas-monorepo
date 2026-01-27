import crypto from "node:crypto";

export interface GoogleOAuthStatePayload {
	organizationId: string;
	userId: string;
	issuedAt: number;
}

function base64UrlEncode(input: string): string {
	return Buffer.from(input, "utf8")
		.toString("base64")
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

function base64UrlDecode(input: string): string {
	const padded = input.replaceAll("-", "+").replaceAll("_", "/");
	const padLen = (4 - (padded.length % 4)) % 4;
	const withPadding = padded + "=".repeat(padLen);
	return Buffer.from(withPadding, "base64").toString("utf8");
}

function hmacSha256(secret: string, data: string): string {
	return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export function createSignedGoogleOAuthState(
	payload: Omit<GoogleOAuthStatePayload, "issuedAt">,
	secret: string,
): string {
	const fullPayload: GoogleOAuthStatePayload = {
		...payload,
		issuedAt: Math.floor(Date.now() / 1000),
	};

	const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
	const signature = hmacSha256(secret, encodedPayload);
	return `${encodedPayload}.${signature}`;
}

export function verifySignedGoogleOAuthState(
	state: string,
	secret: string,
	maxAgeSeconds: number,
): GoogleOAuthStatePayload {
	const [encodedPayload, signature] = state.split(".");
	if (!encodedPayload || !signature) {
		throw new Error("Invalid OAuth state");
	}

	const expected = hmacSha256(secret, encodedPayload);
	const sigBuf = Buffer.from(signature);
	const expBuf = Buffer.from(expected);
	const ok =
		sigBuf.length === expBuf.length &&
		crypto.timingSafeEqual(sigBuf, expBuf);
	if (!ok) {
		throw new Error("Invalid OAuth state signature");
	}

	const payload = JSON.parse(
		base64UrlDecode(encodedPayload),
	) as GoogleOAuthStatePayload;
	if (!payload.issuedAt) {
		throw new Error("Invalid OAuth state payload");
	}

	const age = Math.floor(Date.now() / 1000) - payload.issuedAt;
	if (age < 0 || age > maxAgeSeconds) {
		throw new Error("OAuth state expired");
	}

	return payload;
}
