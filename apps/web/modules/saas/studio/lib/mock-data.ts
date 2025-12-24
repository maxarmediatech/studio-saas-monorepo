/**
 * Mock Data for Booking Form Testing
 *
 * Use these as fallbacks when API returns empty data.
 * Remove once backend has real seed data.
 */

export const MOCK_BOOKING_TYPES = [
	{ id: "bt-1", key: "wedding", label: "Wedding" },
	{ id: "bt-2", key: "portrait", label: "Portrait Session" },
	{ id: "bt-3", key: "commercial", label: "Commercial" },
	{ id: "bt-4", key: "event", label: "Event Coverage" },
	{ id: "bt-5", key: "maternity", label: "Maternity" },
	{ id: "bt-6", key: "newborn", label: "Newborn" },
];

export const MOCK_PACKAGE_TYPES = [
	{
		id: "pt-1",
		key: "basic",
		label: "Basic Package",
		metadata: { defaultCost: "50000" },
	},
	{
		id: "pt-2",
		key: "standard",
		label: "Standard Package",
		metadata: { defaultCost: "100000" },
	},
	{
		id: "pt-3",
		key: "premium",
		label: "Premium Package",
		metadata: { defaultCost: "200000" },
	},
	{
		id: "pt-4",
		key: "luxury",
		label: "Luxury Package",
		metadata: { defaultCost: "350000" },
	},
];

export const MOCK_RELATION_TYPES = [
	{ id: "rt-1", key: "bride", label: "Bride" },
	{ id: "rt-2", key: "groom", label: "Groom" },
	{ id: "rt-3", key: "client", label: "Client" },
	{ id: "rt-4", key: "family", label: "Family Member" },
	{ id: "rt-5", key: "coordinator", label: "Event Coordinator" },
	{ id: "rt-6", key: "parent", label: "Parent" },
];

export const MOCK_CREW_ROLES = [
	{ id: "cr-1", key: "lead_photographer", label: "Lead Photographer" },
	{ id: "cr-2", key: "photographer", label: "Photographer" },
	{ id: "cr-3", key: "lead_videographer", label: "Lead Videographer" },
	{ id: "cr-4", key: "videographer", label: "Videographer" },
	{ id: "cr-5", key: "drone_operator", label: "Drone Operator" },
	{ id: "cr-6", key: "assistant", label: "Assistant" },
	{ id: "cr-7", key: "editor", label: "Editor" },
];

export const MOCK_CLIENTS = [
	{ id: "cl-1", name: "Rahul Sharma", phoneNumber: "+91 98765 43210" },
	{ id: "cl-2", name: "Priya Patel", phoneNumber: "+91 87654 32109" },
	{ id: "cl-3", name: "Amit Kumar", phoneNumber: "+91 76543 21098" },
	{ id: "cl-4", name: "Sneha Reddy", phoneNumber: "+91 65432 10987" },
	{ id: "cl-5", name: "Vikram Mehta", phoneNumber: "+91 54321 09876" },
];

export const MOCK_CREWS = [
	{
		id: "cw-1",
		name: "Vikram Singh",
		role: "Lead Photographer",
		phoneNumber: "+91 99887 76655",
	},
	{
		id: "cw-2",
		name: "Ananya Iyer",
		role: "Photographer",
		phoneNumber: "+91 88776 65544",
	},
	{
		id: "cw-3",
		name: "Rohan Das",
		role: "Lead Videographer",
		phoneNumber: "+91 77665 54433",
	},
	{
		id: "cw-4",
		name: "Kavita Menon",
		role: "Videographer",
		phoneNumber: "+91 66554 43322",
	},
	{
		id: "cw-5",
		name: "Arjun Nair",
		role: "Drone Operator",
		phoneNumber: "+91 55443 32211",
	},
	{
		id: "cw-6",
		name: "Deepak Verma",
		role: "Assistant",
		phoneNumber: "+91 44332 21100",
	},
];
