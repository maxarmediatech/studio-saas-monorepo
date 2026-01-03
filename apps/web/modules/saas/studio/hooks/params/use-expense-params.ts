import {
	type Options,
	parseAsBoolean,
	parseAsString,
	useQueryStates,
} from "nuqs";

export function useExpenseParams(options?: Options) {
	const [params, setParams] = useQueryStates(
		{
			expenseId: parseAsString,
			createExpense: parseAsBoolean,
		},
		{
			history: "push",
			shallow: true,
			...options,
		},
	);

	return {
		...params,
		setParams,
		// Convenience methods
		openCreate: () => setParams({ createExpense: true, expenseId: null }),
		openEdit: (id: string) =>
			setParams({ expenseId: id, createExpense: null }),
		close: () => setParams({ expenseId: null, createExpense: null }),
	};
}
