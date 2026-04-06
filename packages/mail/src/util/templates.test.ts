import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("mail templates", () => {
	beforeEach(() => {
		vi.resetModules();
		process.env = {
			...originalEnv,
			EMAIL_ASSET_BASE_URL: "https://assets.stuwiz.com",
			EMAIL_BASE_URL: "https://app.stuwiz.com",
		};
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		vi.restoreAllMocks();
	});

	it.each([
		{
			templateId: "emailVerification",
			context: {
				name: "Rakesh",
				url: "https://app.stuwiz.com/auth/verify?token=1",
			},
			hasCta: true,
			preview:
				"Verify your email address to keep your Stuwiz account secure.",
			subject: "Verify your email",
		},
		{
			templateId: "forgotPassword",
			context: {
				name: "Rakesh",
				url: "https://app.stuwiz.com/auth/reset-password?token=1",
			},
			hasCta: true,
			preview: "Reset your Stuwiz password with this secure link.",
			subject: "Reset your password",
		},
		{
			templateId: "magicLink",
			context: {
				url: "https://app.stuwiz.com/auth/magic?token=1",
			},
			hasCta: true,
			preview: "Use this secure link to sign in to Stuwiz.",
			subject: "Login to Stuwiz",
		},
		{
			templateId: "newUser",
			context: {
				name: "Rakesh",
				otp: "123456",
				url: "https://app.stuwiz.com/auth/confirm?token=1",
			},
			hasCta: true,
			preview: "Confirm your email to start using Stuwiz.",
			subject: "Confirm your email",
		},
		{
			templateId: "newsletterSignup",
			context: {},
			hasCta: false,
			preview: "You're on the list for Stuwiz updates.",
			subject: "Welcome to our newsletter",
		},
		{
			templateId: "organizationInvitation",
			context: {
				organizationName: "Maxar Media",
				url: "https://app.stuwiz.com/auth/signup?invitationId=1",
			},
			hasCta: true,
			preview: "Maxar Media invited you to join Stuwiz.",
			subject: "Maxar Media invited you to join Stuwiz",
		},
	] as const)("renders $templateId with public URLs and preview text", async ({
		context,
		hasCta,
		preview,
		subject,
		templateId,
	}) => {
		const { getTemplate } = await import("./templates");

		const rendered = await getTemplate({
			templateId,
			context,
			locale: "en",
		});
		const normalizedHtml = rendered.html.replaceAll("&#x27;", "'");

		expect(rendered.subject).toBe(subject);
		expect(normalizedHtml).toContain(preview);
		expect(rendered.html).toContain(
			"https://assets.stuwiz.com/images/brand/stuwiz-logo-dark.png",
		);
		expect(rendered.html).not.toContain("localhost");
		expect(rendered.text).not.toContain("localhost");
		if (hasCta) {
			expect(rendered.html).toMatch(
				/background-color:\s?(#18181b|rgb\(24,\s?24,\s?27\))/i,
			);
		}
	});
});
