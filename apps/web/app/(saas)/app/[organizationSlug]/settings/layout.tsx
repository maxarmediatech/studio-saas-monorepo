import { PageWidthWrapper } from "@saas/studio/components/PageWidthWrapper";
import type { PropsWithChildren } from "react";
import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: PropsWithChildren) {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<SettingsNav />
			<div className="min-h-0 flex-1 overflow-y-auto pt-4 lg:pt-6">
				<PageWidthWrapper className="pb-8">
					{children}
				</PageWidthWrapper>
			</div>
		</div>
	);
}
