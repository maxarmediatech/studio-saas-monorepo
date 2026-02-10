"use client";

import { PageContent } from "@saas/studio";
import { OpenConfigurationCreateSheet } from "@saas/studio/components/configurations/OpenConfigurationSheet";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function SpecialisationsLayout({ children }: Props) {
	return (
		<PageContent
			title="Specialisations"
			controls={
				<OpenConfigurationCreateSheet
					configurationType="crew_role"
					size="sm"
				/>
			}
		>
			{children}
		</PageContent>
	);
}
