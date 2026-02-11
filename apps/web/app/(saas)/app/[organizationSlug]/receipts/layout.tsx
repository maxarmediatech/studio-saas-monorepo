"use client";

import { PageContent } from "@saas/studio";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function ReceiptsLayout({ children }: Props) {
	return <PageContent title="Receipts">{children}</PageContent>;
}
