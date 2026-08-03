import { PageContent } from "@saas/studio";
import type { ReactNode } from "react";

export default function LeadsLayout({ children }: { children: ReactNode }) {
	return <PageContent title="Leads">{children}</PageContent>;
}
