// Components

// Bookings
export {
	BookingsFilters,
	BookingsPageClient,
	BookingsTableClient,
	BookingsTableSkeleton,
} from "./components/bookings";
export { PageContent } from "./components/PageContent";
export { PageHeader } from "./components/PageHeader";
export { PageWidthWrapper } from "./components/PageWidthWrapper";

// Layout - Server component pattern (like winter-arc)
export { AppShell } from "./components/app-shell";
export { AppShellClient } from "./components/app-shell.client";

// API Utilities
export {
	bookingsApi,
	bookingsMutations,
	clientsApi,
	clientsMutations,
	configurationsApi,
	configurationsMutations,
	crewsApi,
	crewsMutations,
	deliverablesApi,
	deliverablesMutations,
	expensesApi,
	expensesMutations,
	shootsApi,
	shootsMutations,
	studioPaymentsApi,
	studioPaymentsMutations,
	studioQueryKeys,
	tasksApi,
	tasksMutations,
} from "./lib/api";

// Navigation
export { getNavigationConfig } from "./lib/navigation/config";
export { filterNavigationConfig } from "./lib/navigation/filter";
export type {
	IconName,
	NavItemConfig,
	NavModuleConfig,
	NavPermission,
	NavPermissionCheck,
	NavSectionConfig,
	NavigationConfig,
} from "./lib/navigation/types";
export { findActiveModuleId, findModuleByPath, isItemActive } from "./lib/navigation/utils";

// Capabilities
export { getCapabilities, selectHeaderCaps } from "./lib/capability.server";
export type { HeaderCapabilities } from "./lib/capability.server";

// Icons
export { IconByName } from "./components/navigation/icon-registry";
export type { IconName as RegistryIconName } from "./components/navigation/icon-registry";
