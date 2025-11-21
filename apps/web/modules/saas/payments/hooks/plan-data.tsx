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
		freelancer: {
			title: t("pricing.products.freelancer.title"),
			description: t("pricing.products.freelancer.description"),
			features: [
				t("pricing.products.freelancer.features.singleStudio"),
				t("pricing.products.freelancer.features.singleCrew"),
				t("pricing.products.freelancer.features.unlimitedBookings"),
			],
		},
		starter: {
			title: t("pricing.products.starter.title"),
			description: t("pricing.products.starter.description"),
			features: [
				t("pricing.products.starter.features.singleStudio"),
				t("pricing.products.starter.features.unlimitedBookings"),
				t("pricing.products.starter.features.crewCap"),
			],
		},
		growth: {
			title: t("pricing.products.growth.title"),
			description: t("pricing.products.growth.description"),
			features: [
				t("pricing.products.growth.features.studios"),
				t("pricing.products.growth.features.unlimitedBookings"),
				t("pricing.products.growth.features.crewCap"),
			],
		},
	};

	return { planData };
}
