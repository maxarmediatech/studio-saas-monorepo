import {
	parseAsBoolean,
	parseAsString,
	useQueryStates,
	type Options,
} from "nuqs";

export function useConfigurationParams(options?: Options) {
	const [params, setParams] = useQueryStates(
		{
			configurationId: parseAsString,
			createConfiguration: parseAsBoolean,
			configurationType: parseAsString, // booking_type, package_type, etc.
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
		openCreate: (type: string) =>
			setParams({ createConfiguration: true, configurationType: type, configurationId: null }),
		openEdit: (id: string, type: string) =>
			setParams({ configurationId: id, configurationType: type, createConfiguration: null }),
		close: () =>
			setParams({ configurationId: null, createConfiguration: null, configurationType: null }),
	};
}
