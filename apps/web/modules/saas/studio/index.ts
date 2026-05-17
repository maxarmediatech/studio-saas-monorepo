// Components

// Activities
export { ActivitiesPageClient } from "./components/activities";
// Layout - AppShell is a server component, import directly from "./components/app-shell"
// Do NOT export here to avoid client bundle contamination
export { AppShellClient } from "./components/app-shell.client";
// Bookings
export {
	BookingsFilters,
	BookingsTableClient,
	BookingsTableSkeleton,
} from "./components/bookings";
// Clients
export {
	ClientsFilters,
	ClientsTableClient,
	ClientsTableSkeleton,
} from "./components/clients";
// Configurations
export {
	ConfigurationsFilters,
	ConfigurationsTableClient,
	ConfigurationsTableSkeleton,
	OpenConfigurationCreateSheet,
	OpenConfigurationEditSheet,
} from "./components/configurations";
// Crews
export {
	CrewsFilters,
	CrewsTableClient,
	CrewsTableSkeleton,
	PeopleWorkerTypeTabs,
} from "./components/crews";
// Deliverables
export {
	DeliverablesFilters,
	DeliverablesPageClient,
	DeliverablesTableClient,
	DeliverablesTableSkeleton,
} from "./components/deliverables";
export type { IconName as RegistryIconName } from "./components/navigation/icon-registry";
// Icons
export { IconByName } from "./components/navigation/icon-registry";
export { PageContent } from "./components/PageContent";
export { PageHeader } from "./components/PageHeader";
export { PageWidthWrapper } from "./components/PageWidthWrapper";
// Shoots
export {
	ShootsFilters,
	ShootsPageClient,
	ShootsTableClient,
	ShootsTableSkeleton,
} from "./components/shoots";
export {
	WhatsAppContactsPageClient,
	WhatsAppInboxPageClient,
	WhatsAppTemplatesPageClient,
} from "./components/whatsapp";
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
	submissionsApi,
	submissionsMutations,
	tasksApi,
	tasksMutations,
	whatsappApi,
	whatsappMutations,
} from "./lib/api";
export type { HeaderCapabilities } from "./lib/capability.server";
// Capabilities
export { getCapabilities, selectHeaderCaps } from "./lib/capability.server";
// Navigation
export { getNavigationConfig } from "./lib/navigation/config";
export { filterNavigationConfig } from "./lib/navigation/filter";
export type {
	IconName,
	NavItemConfig,
	NavigationConfig,
	NavModuleConfig,
	NavPermission,
	NavPermissionCheck,
	NavSectionConfig,
} from "./lib/navigation/types";
export {
	findActiveModuleId,
	findModuleByPath,
	isItemActive,
} from "./lib/navigation/utils";
