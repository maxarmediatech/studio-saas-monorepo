export function extractApiErrorMessage(
	error: unknown,
	fallback = "An unexpected error occurred",
): string {
	if (!error) {
		return fallback;
	}

	if (typeof error === "string") {
		return error;
	}

	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "object" && "message" in error) {
		const msg = (error as { message: unknown }).message;
		if (typeof msg === "string") {
			return msg;
		}
	}

	return fallback;
}
