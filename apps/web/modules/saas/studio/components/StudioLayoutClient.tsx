"use client";

import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { SheetProvider } from "@saas/shared/components/sheet-provider";
import { StudioLayout } from "./StudioLayout";

interface StudioLayoutClientProps {
	children: React.ReactNode;
}

export function StudioLayoutClient({ children }: StudioLayoutClientProps) {
	const { activeOrganization } = useActiveOrganization();

	if (!activeOrganization) {
		return null;
	}

	return (
		<SheetProvider>
			<StudioLayout
				studioSlug={activeOrganization.slug ?? ""}
				studioName={activeOrganization.name}
				studioLogo={activeOrganization.logo}
			>
				{children}
			</StudioLayout>
		</SheetProvider>
	);
}
