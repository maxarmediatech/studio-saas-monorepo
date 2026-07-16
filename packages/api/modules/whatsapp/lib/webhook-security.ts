import crypto from "node:crypto";

export const verifyWebhookSignature = (
	rawBody: string,
	signatureHeader: string,
	appSecret: string,
) => {
	const [scheme, receivedSignature] = signatureHeader.split("=", 2);
	if (scheme !== "sha256" || !receivedSignature) {
		return false;
	}

	const expectedSignature = crypto
		.createHmac("sha256", appSecret)
		.update(rawBody)
		.digest("hex");

	const expectedBuffer = Buffer.from(expectedSignature, "hex");
	const receivedBuffer = Buffer.from(receivedSignature, "hex");

	if (expectedBuffer.length !== receivedBuffer.length) {
		return false;
	}

	return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};
