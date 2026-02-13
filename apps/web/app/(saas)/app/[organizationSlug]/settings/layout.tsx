import type { PropsWithChildren } from "react";
import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: PropsWithChildren) {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<SettingsNav />
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-screen-xl">{children}</div>
			</div>
		</div>
	);
}
