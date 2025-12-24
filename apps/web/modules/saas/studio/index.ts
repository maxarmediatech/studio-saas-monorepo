// Components
export { ModulePanel } from "./components/ModulePanel";
export { MobileNav } from "./components/MobileNav";
export { StudioSidebar, useStudioSidebar } from "./components/StudioSidebar";
export { StudioLayout } from "./components/StudioLayout";
export { StudioLayoutClient } from "./components/StudioLayoutClient";

// Bookings
export { BookingsPageClient } from "./components/bookings";

// Types
export type {
	IconName,
	ModuleId,
	NavItem,
	NavModule,
	NavSection,
	SidebarData,
} from "./lib/types";

// Utilities
export { getIcon, iconRegistry } from "./lib/icons";
export {
	buildUrl,
	findActiveModule,
	getSidebarData,
} from "./lib/navigation";

// API Utilities
export {
	studioQueryKeys,
	bookingsApi,
	bookingsMutations,
	clientsApi,
	clientsMutations,
	crewsApi,
	crewsMutations,
	shootsApi,
	shootsMutations,
} from "./lib/api";
