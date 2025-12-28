"use client";

import { TooltipProvider } from "@repo/ui/components/tooltip";
import type {
	NavItemConfig,
	NavModuleConfig,
	RailIconConfig,
} from "../../lib/navigation/types";
import { SidebarRail } from "./sidebar-rail";
import { SidebarPanel } from "./sidebar-panel";

interface DubSidebarProps {
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	railIcons: RailIconConfig[];
	activeModule: NavModuleConfig;
	activeModuleId: string;
	utilities: NavItemConfig[];
	userName: string;
	userImage?: string | null;
}

export function DubSidebar({
	studioSlug,
	studioName,
	studioLogo,
	railIcons,
	activeModule,
	activeModuleId,
	utilities,
	userName,
	userImage,
}: DubSidebarProps) {
	return (
		<TooltipProvider delayDuration={0}>
			<aside className="sticky top-0 z-40 hidden h-screen md:flex">
				<SidebarRail
					studioSlug={studioSlug}
					studioName={studioName}
					studioLogo={studioLogo}
					railIcons={railIcons}
					activeModuleId={activeModuleId}
					userName={userName}
					userImage={userImage}
				/>
				<SidebarPanel module={activeModule} utilities={utilities} />
			</aside>
		</TooltipProvider>
	);
}
