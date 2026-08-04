import type { NavItemConfig } from "./types";

export function getCrmNavigationItems(
	url: (path: string) => string,
): NavItemConfig[] {
	return [
		{
			id: "leads",
			label: "Leads",
			path: url("/leads"),
			icon: "Contact2",
			permission: {
				any: [{ resource: "client", action: "list" }],
			},
		},
		{
			id: "clients",
			label: "Clients",
			path: url("/clients"),
			icon: "Contact2",
			permission: {
				any: [{ resource: "client", action: "list" }],
			},
		},
		{
			id: "quotations",
			label: "Quotations",
			path: url("/quotations"),
			icon: "FileText",
			permission: {
				any: [{ resource: "quote", action: "list" }],
			},
		},
	];
}
