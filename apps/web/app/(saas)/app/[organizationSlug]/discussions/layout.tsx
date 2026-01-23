"use client";

import { PageContent } from "@saas/studio";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function DiscussionsLayout({ children }: Props) {
	return <PageContent title="Discussions">{children}</PageContent>;
}
