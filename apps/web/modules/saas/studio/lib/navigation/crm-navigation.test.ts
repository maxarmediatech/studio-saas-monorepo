import { describe, expect, it } from "vitest";
import { getCrmNavigationItems } from "./crm-navigation";

describe("CRM navigation", () => {
	it("places Leads, Clients, and Quotations together in that order", () => {
		expect(
			getCrmNavigationItems((path) => `/app/studio${path}`),
		).toMatchObject([
			{ id: "leads", path: "/app/studio/leads" },
			{ id: "clients", path: "/app/studio/clients" },
			{ id: "quotations", path: "/app/studio/quotations" },
		]);
	});
});
