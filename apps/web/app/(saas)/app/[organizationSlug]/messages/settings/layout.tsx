import type { PropsWithChildren } from "react";
import { MessageSettingsNav } from "./settings-nav";

type MessageSettingsLayoutProps = PropsWithChildren<{
	params: Promise<{ organizationSlug: string }>;
}>;

export default async function MessageSettingsLayout({
	children,
	params,
}: MessageSettingsLayoutProps) {
	const { organizationSlug } = await params;

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			<MessageSettingsNav organizationSlug={organizationSlug} />
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-screen-xl">{children}</div>
			</div>
		</div>
	);
}
