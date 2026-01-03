import {
	type Options,
	parseAsBoolean,
	parseAsString,
	useQueryStates,
} from "nuqs";

export function useDeliverableParams(options?: Options) {
	const [params, setParams] = useQueryStates(
		{
			deliverableId: parseAsString,
			createDeliverable: parseAsBoolean,
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
		openCreate: () =>
			setParams({ createDeliverable: true, deliverableId: null }),
		openEdit: (id: string) =>
			setParams({ deliverableId: id, createDeliverable: null }),
		close: () =>
			setParams({ deliverableId: null, createDeliverable: null }),
	};
}
