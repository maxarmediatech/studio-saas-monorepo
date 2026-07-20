import { assertPaymentsEnv } from "@repo/env";
import DodoPayments from "dodopayments";

let dodoPaymentsClient: DodoPayments | null = null;

type DodoPaymentsEnvironment = "test_mode" | "live_mode";

export function getDodoPaymentsEnvironment(): DodoPaymentsEnvironment {
	const environment = process.env.DODO_PAYMENTS_ENVIRONMENT;
	if (environment === "test_mode" || environment === "live_mode") {
		return environment;
	}

	return process.env.NODE_ENV === "production" ? "live_mode" : "test_mode";
}

export function getDodoPaymentsClient() {
	if (dodoPaymentsClient) {
		return dodoPaymentsClient;
	}

	const { DODO_PAYMENTS_API_KEY: dodoPaymentsApiKey } = assertPaymentsEnv();

	dodoPaymentsClient = new DodoPayments({
		bearerToken: dodoPaymentsApiKey,
		environment: getDodoPaymentsEnvironment(),
	});

	return dodoPaymentsClient;
}
