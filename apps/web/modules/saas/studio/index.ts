// Components

// Bookings
export {
	BookingsFilters,
	BookingsPageClient,
	BookingsTableClient,
	BookingsTableSkeleton,
} from "./components/bookings";
export { PageHeader } from "./components/PageHeader";
export { StudioLayoutClient } from "./components/StudioLayoutClient";

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

// Icons
export { getIcon, iconRegistry } from "./lib/icons";
