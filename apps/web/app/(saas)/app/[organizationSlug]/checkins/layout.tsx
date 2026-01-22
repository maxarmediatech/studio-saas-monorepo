"use client";

import { PageContent } from "@saas/studio";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function CheckinsLayout({ children }: Props) {
	return <PageContent title="Checkins">{children}</PageContent>;
}
