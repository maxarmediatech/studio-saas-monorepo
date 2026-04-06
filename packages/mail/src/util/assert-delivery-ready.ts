import { getPublicAssetBaseUrl, getPublicBaseUrl } from "@repo/utils";

export function assertTransactionalEmailDeliveryReady() {
	if (!process.env.RESEND_API_KEY) {
		throw new Error("RESEND_API_KEY is missing.");
	}

	getPublicBaseUrl({ allowLocalhost: false });
	getPublicAssetBaseUrl({ allowLocalhost: false });
}
