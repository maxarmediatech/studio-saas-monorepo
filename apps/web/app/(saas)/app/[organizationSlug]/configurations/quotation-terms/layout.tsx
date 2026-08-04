"use client";

import { PageContent } from "@saas/studio";
import { OpenConfigurationCreateSheet } from "@saas/studio/components/configurations/OpenConfigurationSheet";
import type { ReactNode } from "react";

export default function QuotationTermsLayout({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<PageContent
			title="Quotation Terms"
			controls={
				<OpenConfigurationCreateSheet
					configurationType="quotation_terms"
					label="Add preset"
					size="sm"
				/>
			}
		>
			{children}
		</PageContent>
	);
}
