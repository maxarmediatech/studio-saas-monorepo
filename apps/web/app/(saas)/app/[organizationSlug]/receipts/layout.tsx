"use client";

import { PageContent } from "@saas/studio";
import { usePathname } from "next/navigation";
import { type ReactNode, use } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function ReceiptsLayout({ params, children }: Props) {
	const { organizationSlug } = use(params);
	const pathname = usePathname();
	const baseRoute = `/app/${organizationSlug}/receipts`;

	// Detail pages use their own PageContent with backHref + controls
	const isDetailPage =
		pathname !== baseRoute && pathname.startsWith(`${baseRoute}/`);

	if (isDetailPage) {
		return <>{children}</>;
	}

	return <PageContent title="Receipts">{children}</PageContent>;
}
