import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("resend provider", () => {
	beforeEach(() => {
		vi.resetModules();
		process.env.RESEND_API_KEY = "re_test";
		process.env.EMAIL_FROM_NAME = "Stuwiz";
		process.env.EMAIL_FROM_ADDRESS = "noreply@updates.stuwiz.com";
		process.env.EMAIL_REPLY_TO = "hello@stuwiz.com";
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		vi.restoreAllMocks();
	});

	it("formats branded sender metadata and reply-to", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
		});
		vi.stubGlobal("fetch", fetchMock);

		const { send } = await import("./resend");

		await send({
			to: "hello@example.com",
			subject: "Test subject",
			text: "Test body",
			replyTo: "support@stuwiz.com",
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const request = fetchMock.mock.calls[0]?.[1];
		const body =
			typeof request?.body === "string" ? JSON.parse(request.body) : null;

		expect(body).toMatchObject({
			from: "Stuwiz <noreply@updates.stuwiz.com>",
			reply_to: "support@stuwiz.com",
			subject: "Test subject",
			to: "hello@example.com",
		});
	});

	it("passes attachments and default reply-to to resend", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
		});
		vi.stubGlobal("fetch", fetchMock);

		const { send } = await import("./resend");

		await send({
			to: "hello@example.com",
			subject: "Calendar invite",
			text: "Attached invite",
			attachments: [
				{
					filename: "invite.ics",
					content: "Zm9v",
					contentType: "text/calendar; charset=utf-8",
				},
			],
		});

		const request = fetchMock.mock.calls[0]?.[1];
		const body =
			typeof request?.body === "string" ? JSON.parse(request.body) : null;

		expect(body).toMatchObject({
			reply_to: "hello@stuwiz.com",
			attachments: [
				{
					filename: "invite.ics",
					content: "Zm9v",
					contentType: "text/calendar; charset=utf-8",
				},
			],
		});
	});

	it("throws when resend rejects the request", async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 422,
			json: vi.fn().mockResolvedValue({
				error: "invalid_request",
			}),
		});
		vi.stubGlobal("fetch", fetchMock);

		const { send } = await import("./resend");

		await expect(
			send({
				to: "hello@example.com",
				subject: "Broken",
				text: "Broken",
			}),
		).rejects.toThrow("Could not send email via Resend.");
	});
});
