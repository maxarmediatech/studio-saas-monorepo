"use client";

import { PageContent } from "@saas/studio";
import { OpenConfigurationCreateSheet } from "@saas/studio/components/configurations/OpenConfigurationSheet";
import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

export default function PackageTypesLayout({ children }: Props) {
	return (
		<PageContent
			title="Package Types"
			controls={
				<OpenConfigurationCreateSheet
					configurationType="package_type"
					size="sm"
				/>
			}
		>
			{children}
		</PageContent>
	);
}
