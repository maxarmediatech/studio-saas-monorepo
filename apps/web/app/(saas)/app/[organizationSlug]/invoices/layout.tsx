"use client";

import { PageContent } from "@saas/studio";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function InvoicesLayout({ children }: Props) {
	return <PageContent title="Invoices">{children}</PageContent>;
}
