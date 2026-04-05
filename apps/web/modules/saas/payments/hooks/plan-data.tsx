import type { config } from "@repo/config";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type ProductReferenceId = keyof (typeof config)["payments"]["plans"];

export function usePlanData() {
	const t = useTranslations();

	const planData: Record<
		ProductReferenceId,
		{
			title: string;
			description: ReactNode;
			features: ReactNode[];
		}
	> = {
		"studio-basics": {
			title: t("pricing.products.studio-basics.title"),
			description: t("pricing.products.studio-basics.description"),
			features: [
				t("pricing.products.studio-basics.features.bookings"),
				t("pricing.products.studio-basics.features.clients"),
				t("pricing.products.studio-basics.features.crew"),
				t("pricing.products.studio-basics.features.finance"),
				t("pricing.products.studio-basics.features.ops"),
				t("pricing.products.studio-basics.features.setup"),
			],
		},
		"studio-advance": {
			title: t("pricing.products.studio-advance.title"),
			description: t("pricing.products.studio-advance.description"),
			features: [
				t(
					"pricing.products.studio-advance.features.everythingInBasics",
				),
				t("pricing.products.studio-advance.features.whatsappFlows"),
				t(
					"pricing.products.studio-advance.features.priorityAutomation",
				),
				t("pricing.products.studio-advance.features.comingSoon"),
			],
		},
	};

	return { planData };
}
