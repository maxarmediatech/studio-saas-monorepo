import {
	type Options,
	parseAsString,
	useQueryStates,
} from "nuqs";

export function useBookingParams(options?: Options) {
	const [params, setParams] = useQueryStates(
		{
			bookingId: parseAsString,
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
		openView: (id: string) => setParams({ bookingId: id }),
		close: () => setParams({ bookingId: null }),
	};
}
