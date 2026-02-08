import type { EnvConfigErrorCode } from "@repo/env";
import { isEnvConfigError } from "@repo/env";
import { NextResponse } from "next/server";

const ENV_ERROR_MESSAGES: Record<EnvConfigErrorCode, string> = {
	ENV_CORE_MISSING: "Core environment variables are misconfigured.",
	ENV_STORAGE_MISSING:
		"Storage is not configured on this deployment.",
	ENV_PAYMENTS_MISSING:
		"Payments are not configured on this deployment.",
};

export function createEnvConfigResponse(code: EnvConfigErrorCode) {
	return NextResponse.json(
		{
			message: ENV_ERROR_MESSAGES[code],
			code,
		},
		{
			status: 503,
		},
	);
}

export function createEnvErrorResponse(error: unknown) {
	if (!isEnvConfigError(error)) {
		return null;
	}

	return createEnvConfigResponse(error.code);
}
