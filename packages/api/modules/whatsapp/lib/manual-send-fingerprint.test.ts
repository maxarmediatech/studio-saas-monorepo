import { describe, expect, it } from "vitest";
import {
	canonicalManualSendJson,
	manualWhatsAppSendFingerprint,
} from "./manual-send-fingerprint";

describe("manual WhatsApp send fingerprint", () => {
	it("canonicalizes object key order recursively", () => {
		expect(
			canonicalManualSendJson({
				z: 1,
				nested: { beta: 2, alpha: 1 },
			}),
		).toBe('{"nested":{"alpha":1,"beta":2},"z":1}');
	});

	it("normalizes omitted template components to an empty list", () => {
		const base = {
			kind: "template" as const,
			accountId: "account_1",
			to: "919999999999",
			templateName: "booking_confirmation",
			language: "en_US",
		};

		expect(manualWhatsAppSendFingerprint(base)).toBe(
			manualWhatsAppSendFingerprint({ ...base, components: [] }),
		);
	});

	it("changes when any send-defining field changes", () => {
		const base = {
			kind: "text" as const,
			accountId: "account_1",
			to: "919999999999",
			text: "Hello",
			contactName: "Riya",
		};
		const original = manualWhatsAppSendFingerprint(base);

		for (const changed of [
			{ ...base, accountId: "account_2" },
			{ ...base, to: "918888888888" },
			{ ...base, text: "Hello again" },
			{ ...base, contactName: "Asha" },
		]) {
			expect(manualWhatsAppSendFingerprint(changed)).not.toBe(original);
		}
	});
});
