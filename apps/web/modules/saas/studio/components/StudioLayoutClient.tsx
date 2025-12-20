"use client";

import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
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
		<StudioLayout
			studioSlug={activeOrganization.slug ?? ""}
			studioName={activeOrganization.name}
			studioLogo={activeOrganization.logo}
		>
			{children}
		</StudioLayout>
	);
}
