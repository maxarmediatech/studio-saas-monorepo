import { describe, expect, it } from "vitest";
import {
	parseSseEvent,
	parseSseMessage,
	readDeltaText,
} from "../controller-utils";

describe("parseSseEvent", () => {
	it("reads event names and multiline data", () => {
		expect(
			parseSseEvent('event: runtime\ndata: {"a":1}\ndata: {"b":2}'),
		).toEqual({
			eventName: "runtime",
			data: '{"a":1}\n{"b":2}',
		});
	});

	it("ignores messages without data", () => {
		expect(parseSseEvent("event: ping")).toBeUndefined();
	});
});

describe("parseSseMessage", () => {
	it("ignores ready and ping events", () => {
		expect(parseSseMessage("event: ready\ndata: {}")).toBeUndefined();
		expect(parseSseMessage("event: ping\ndata: {}")).toBeUndefined();
	});

	it("parses runtime event payloads", () => {
		expect(
			parseSseMessage(
				'event: runtime\ndata: {"kind":"notification","method":"turn/completed"}',
			),
		).toEqual({
			kind: "notification",
			method: "turn/completed",
		});
	});
});

describe("readDeltaText", () => {
	it("reads legacy string deltas", () => {
		expect(readDeltaText({ delta: "hello" })).toBe("hello");
	});

	it("reads nested object deltas", () => {
		expect(
			readDeltaText({
				delta: { text: "nested" },
			}),
		).toBe("nested");
	});

	it("joins content array text deltas", () => {
		expect(
			readDeltaText({
				delta: {
					content: [
						{ type: "output_text", text: "hel" },
						{ type: "output_text", text: "lo" },
					],
				},
			}),
		).toBe("hello");
	});

	it("reads item/message text fallback shapes", () => {
		expect(
			readDeltaText({
				item: { content: [{ text: "from item" }] },
			}),
		).toBe("from item");
		expect(
			readDeltaText({
				message: { parts: [{ text: "from " }, { text: "parts" }] },
			}),
		).toBe("from parts");
	});

	it("returns undefined for non-text deltas", () => {
		expect(readDeltaText({ delta: { annotations: [] } })).toBeUndefined();
	});
});
