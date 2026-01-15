"use client";

import { PageContent } from "@saas/studio";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function YourWorkLayout({ children }: Props) {
	return <PageContent title="Your Work">{children}</PageContent>;
}
