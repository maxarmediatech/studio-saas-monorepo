import { describe, expect, it } from "vitest";
import { createTaskInputSchema } from "./task";

const bookingId = "00000000-0000-4000-8000-000000000001";
const deliverableId = "00000000-0000-4000-8000-000000000002";
const otherDeliverableId = "00000000-0000-4000-8000-000000000003";

const baseTask = {
	bookingId,
	name: "Edit gallery",
};

describe("createTaskInputSchema deliverable links", () => {
	it("accepts unique informational deliverable ids", () => {
		const result = createTaskInputSchema.parse({
			...baseTask,
			deliverableIds: [deliverableId, otherDeliverableId],
		});

		expect(result.deliverableIds).toEqual([
			deliverableId,
			otherDeliverableId,
		]);
	});

	it("rejects duplicate deliverable ids", () => {
		const result = createTaskInputSchema.safeParse({
			...baseTask,
			deliverableIds: [deliverableId, deliverableId],
		});

		expect(result.success).toBe(false);
	});
});
