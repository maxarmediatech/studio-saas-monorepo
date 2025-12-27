import { parseAsStringLiteral, useQueryState, type Options } from "nuqs";
import type { ModuleId } from "../../lib/types";

const MODULE_IDS = ["studio", "configurations"] as const;

export function useSidebarParams(options?: Options) {
	const [browseModule, setBrowseModule] = useQueryState(
		"module",
		parseAsStringLiteral(MODULE_IDS).withOptions({
			history: "replace", // Don't pollute history with module browsing
			shallow: true, // Don't trigger server re-fetch
			...options,
		}),
	);

	return {
		/** The module being browsed (from URL param), null if not browsing */
		browseModule: browseModule as ModuleId | null,
		/** Set the module to browse */
		setBrowseModule,
		/** Clear the browse state (go back to showing URL's module) */
		clearBrowse: () => setBrowseModule(null),
	};
}
