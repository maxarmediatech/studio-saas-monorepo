import { describe, expect, it } from "vitest";
import { inspectWhatsAppTemplate } from "./template-inspector";

describe("inspectWhatsAppTemplate", () => {
	it("flags media headers as unsupported", () => {
		expect(
			inspectWhatsAppTemplate([
				{
					type: "HEADER",
					format: "IMAGE",
				},
				{
					type: "BODY",
					text: "Booking for {{1}}",
				},
			]),
		).toMatchObject({
			isSupported: false,
			unsupportedReason:
				"Header format image is not supported in the inbox template sender yet.",
		});
	});

	it("extracts button url variables for supported templates", () => {
		expect(
			inspectWhatsAppTemplate([
				{
					type: "BODY",
					text: "Open {{1}}",
				},
				{
					type: "BUTTONS",
					buttons: [
						{
							type: "URL",
							text: "Track",
							url: "https://example.com/{{1}}",
						},
					],
				},
			]),
		).toMatchObject({
			isSupported: true,
			variables: [
				{
					key: "body:1",
					componentType: "body",
					index: 1,
				},
				{
					key: "button:0:1",
					componentType: "button",
					index: 1,
					buttonIndex: 0,
					buttonSubType: "url",
				},
			],
		});
	});
});
