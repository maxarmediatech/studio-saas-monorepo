const INTERNAL_REDIRECT_ORIGIN = "https://app.local";

function hasControlCharacters(input: string): boolean {
	for (let index = 0; index < input.length; index += 1) {
		const code = input.charCodeAt(index);
		if ((code >= 0 && code <= 31) || code === 127) {
			return true;
		}
	}

	return false;
}

function parseInternalPath(path: string | null | undefined): string | null {
	if (!path) {
		return null;
	}

	const candidate = path.trim();
	if (!candidate) {
		return null;
	}

	// Prevent path confusion and header-splitting style payloads.
	if (
		hasControlCharacters(candidate) ||
		candidate.includes("\\") ||
		!candidate.startsWith("/")
	) {
		return null;
	}

	try {
		const parsed = new URL(candidate, INTERNAL_REDIRECT_ORIGIN);
		if (parsed.origin !== INTERNAL_REDIRECT_ORIGIN) {
			return null;
		}

		return `${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return null;
	}
}

export function sanitizeRedirectPath(
	redirectTo: string | null | undefined,
	fallback = "/",
): string {
	return parseInternalPath(redirectTo) ?? parseInternalPath(fallback) ?? "/";
}
