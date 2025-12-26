import {
	type Options,
	parseAsBoolean,
	parseAsString,
	useQueryStates,
} from "nuqs";

export function useShootParams(options?: Options) {
	const [params, setParams] = useQueryStates(
		{
			shootId: parseAsString,
			createShoot: parseAsBoolean,
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
		openCreate: () => setParams({ createShoot: true, shootId: null }),
		openEdit: (id: string) => setParams({ shootId: id, createShoot: null }),
		close: () => setParams({ shootId: null, createShoot: null }),
	};
}
