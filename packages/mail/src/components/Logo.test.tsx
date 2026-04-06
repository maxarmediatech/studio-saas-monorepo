import { render } from "@react-email/render";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logo } from "./Logo";

const originalEnv = { ...process.env };

describe("mail logo", () => {
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

	it("renders the full stuwiz lockup by default", async () => {
		const html = await render(<Logo />);

		expect(html).toContain(
			"https://assets.stuwiz.com/images/brand/stuwiz-logo-dark.png",
		);
	});

	it("renders the compact stuwiz mark when the label is disabled", async () => {
		const html = await render(<Logo withLabel={false} />);

		expect(html).toContain(
			"https://assets.stuwiz.com/images/brand/stuwiz-mark-tight.png",
		);
		expect(html).not.toContain("/icon.png");
	});
});
