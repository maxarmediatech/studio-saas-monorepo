export const PEOPLE_WORKER_TYPE_TABS = [
	{ value: "all", label: "All" },
	{ value: "internal", label: "Members" },
	{ value: "freelancer", label: "Contractual" },
] as const;

export function getWorkerTypeLabel(workerType: "internal" | "freelancer") {
	return workerType === "internal" ? "Member" : "Contractual";
}
