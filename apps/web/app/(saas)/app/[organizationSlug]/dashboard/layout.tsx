"use client";

import { PageContent } from "@saas/studio";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function DashboardLayout({ children }: Props) {
	return <PageContent title="Dashboard">{children}</PageContent>;
}
