export function partitionQuotationContacts<
	T extends { lifecycleStage: "lead" | "client" },
>(rows: T[]) {
	return {
		leads: rows.filter(({ lifecycleStage }) => lifecycleStage === "lead"),
		clients: rows.filter(
			({ lifecycleStage }) => lifecycleStage === "client",
		),
	};
}
