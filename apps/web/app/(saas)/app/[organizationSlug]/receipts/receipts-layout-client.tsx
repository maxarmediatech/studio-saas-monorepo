"use client";

import { PageContent } from "@saas/studio";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
	organizationSlug: string;
	children: ReactNode;
};

export function ReceiptsLayoutClient({ organizationSlug, children }: Props) {
	const pathname = usePathname();
	const baseRoute = `/app/${organizationSlug}/receipts`;
	const isDetailPage =
		pathname !== baseRoute && pathname.startsWith(`${baseRoute}/`);

	if (isDetailPage) {
		return <>{children}</>;
	}

	return <PageContent title="Receipts">{children}</PageContent>;
}
