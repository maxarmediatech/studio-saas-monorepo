import { assertPaymentsEnv } from "@repo/env";
import DodoPayments from "dodopayments";

let dodoPaymentsClient: DodoPayments | null = null;

export function getDodoPaymentsClient() {
	if (dodoPaymentsClient) {
		return dodoPaymentsClient;
	}

	const { DODO_PAYMENTS_API_KEY: dodoPaymentsApiKey } = assertPaymentsEnv();
	const environment =
		process.env.NODE_ENV === "production" ? "live_mode" : "test_mode";

	dodoPaymentsClient = new DodoPayments({
		bearerToken: dodoPaymentsApiKey,
		environment,
	});

	return dodoPaymentsClient;
}
