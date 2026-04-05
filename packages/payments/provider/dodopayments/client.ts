import { assertPaymentsEnv } from "@repo/env";
import DodoPayments from "dodopayments";

let dodoPaymentsClient: DodoPayments | null = null;

export function getDodoPaymentsClient() {
	if (dodoPaymentsClient) {
		return dodoPaymentsClient;
	}

	const { DODO_PAYMENTS_API_KEY: dodoPaymentsApiKey } = assertPaymentsEnv();

	dodoPaymentsClient = new DodoPayments({
		bearerToken: dodoPaymentsApiKey,
		environment: "test_mode",
		// environment:
		// 	process.env.NODE_ENV === "production" ? "live_mode" : "test_mode",
	});

	return dodoPaymentsClient;
}
