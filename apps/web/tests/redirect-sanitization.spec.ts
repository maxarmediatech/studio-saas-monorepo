import { expect, test } from "@playwright/test";
import { sanitizeRedirectPath } from "../modules/shared/lib/sanitize-redirect-path";

test.describe("redirect sanitization", () => {
	test("keeps internal path with query and hash", () => {
		expect(
			sanitizeRedirectPath(
				"/app/test-org/home?tab=recent&view=list#section",
				"/app",
			),
		).toBe("/app/test-org/home?tab=recent&view=list#section");
	});

	test("rejects absolute external URL", () => {
		expect(sanitizeRedirectPath("https://evil.example/phish", "/app")).toBe(
			"/app",
		);
	});

	test("rejects protocol-relative URL", () => {
		expect(sanitizeRedirectPath("//evil.example/phish", "/app")).toBe(
			"/app",
		);
	});

	test("rejects non-path input", () => {
		expect(sanitizeRedirectPath("javascript:alert(1)", "/app")).toBe(
			"/app",
		);
	});

	test("rejects backslash path confusion input", () => {
		expect(sanitizeRedirectPath("/\\evil.example/path", "/app")).toBe(
			"/app",
		);
	});

	test("falls back to root when redirect and fallback are invalid", () => {
		expect(
			sanitizeRedirectPath("https://evil.example/phish", "https://bad"),
		).toBe("/");
	});
});
