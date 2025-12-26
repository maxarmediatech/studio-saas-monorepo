import {
	parseAsBoolean,
	parseAsString,
	useQueryStates,
	type Options,
} from "nuqs";

export function useCrewParams(options?: Options) {
	const [params, setParams] = useQueryStates(
		{
			crewId: parseAsString,
			createCrew: parseAsBoolean,
		},
		{
			history: "push",
			shallow: true,
			...options,
		}
	);

	return {
		...params,
		setParams,
		// Convenience methods
		openCreate: () => setParams({ createCrew: true, crewId: null }),
		openEdit: (id: string) => setParams({ crewId: id, createCrew: null }),
		close: () => setParams({ crewId: null, createCrew: null }),
	};
}
