"use client";

import { createSheetParams } from "./create-sheet-params";

const useSheetParams = createSheetParams({
	namespace: "configurationView",
	idParam: "viewConfigurationId",
	createParam: "createConfigurationView",
});

export function useConfigurationViewParams() {
	const { entityId, setParams, ...methods } = useSheetParams();

	return {
		configurationId: entityId,
		setParams: (params: { configurationId?: string | null }) =>
			setParams({
				entityId: params.configurationId,
			}),
		...methods,
	};
}
