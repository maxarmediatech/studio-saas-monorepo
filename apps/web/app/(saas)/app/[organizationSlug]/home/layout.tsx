"use client";

import { PageContent } from "@saas/studio";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function HomeLayout({ children }: Props) {
	return <PageContent title="Home">{children}</PageContent>;
}
