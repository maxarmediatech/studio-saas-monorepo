import {
	type Options,
	parseAsBoolean,
	parseAsString,
	useQueryStates,
} from "nuqs";

export function usePaymentParams(options?: Options) {
	const [params, setParams] = useQueryStates(
		{
			paymentId: parseAsString,
			createPayment: parseAsBoolean,
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
		openCreate: () => setParams({ createPayment: true, paymentId: null }),
		openEdit: (id: string) =>
			setParams({ paymentId: id, createPayment: null }),
		close: () => setParams({ paymentId: null, createPayment: null }),
	};
}
