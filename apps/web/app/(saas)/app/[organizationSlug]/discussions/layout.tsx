"use client";

import { cn } from "@repo/ui/lib/utils";
import { ChannelsSidebar } from "@saas/studio/components/discussions/channels-sidebar";
import {
	DiscussionSidebarProvider,
	useDiscussionSidebar,
} from "@saas/studio/components/discussions/discussion-sidebar-context";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

function DiscussionsLayoutInner({ children }: { children: ReactNode }) {
	const { isExpanded } = useDiscussionSidebar();

	return (
		<div className="flex h-full min-h-0 flex-1 overflow-hidden">
			<aside
				className={cn(
					"hidden shrink-0 flex-col border-r bg-neutral-50/50 md:flex",
					"transition-[width] duration-300 ease-in-out overflow-hidden",
					isExpanded ? "w-60 lg:w-64" : "w-0",
				)}
			>
				<div className="h-full w-60 lg:w-64">
					<ChannelsSidebar />
				</div>
			</aside>

			<main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
				{children}
			</main>
		</div>
	);
}

export default function DiscussionsLayout({ children }: Props) {
	return (
		<DiscussionSidebarProvider>
			<DiscussionsLayoutInner>{children}</DiscussionsLayoutInner>
		</DiscussionSidebarProvider>
	);
}
