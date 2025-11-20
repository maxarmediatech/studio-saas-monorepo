import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import type { PropsWithChildren } from "react";

import { DashboardSidebar } from "@/modules/dashboard/components";

export default function DashboardLayout({ children }: PropsWithChildren) {
	return (
		<SidebarProvider className="bg-sidebar">
			<DashboardSidebar />
			<SidebarInset>
				<div className="h-svh overflow-hidden lg:p-2 w-full bg-sidebar">
					<div className="lg:border lg:rounded-md overflow-hidden flex flex-col items-center justify-start h-full w-full bg-background">
						{children}
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
