import { describe, expect, it } from "vitest";
import { listClientsInputSchema } from "./client";

describe("listClientsInputSchema", () => {
	it("defaults the Clients view to client rows", () => {
		expect(listClientsInputSchema.parse({}).lifecycleStage).toBe("client");
	});

	it("allows the Leads view to request only lead rows", () => {
		expect(
			listClientsInputSchema.parse({ lifecycleStage: "lead" })
				.lifecycleStage,
		).toBe("lead");
	});
});
