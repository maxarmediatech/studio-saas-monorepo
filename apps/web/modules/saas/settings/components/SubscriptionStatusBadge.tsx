"use client";

import { Badge } from "@repo/ui/components/badge";
import { useTranslations } from "next-intl";

export function SubscriptionStatusBadge({
	status,
}: {
	status: string;
	className?: string;
}) {
	const t = useTranslations();
	const normalizedStatus = (() => {
		const normalized = status.toLowerCase();
		if (normalized === "cancelled") {
			return "canceled";
		}
		if (normalized === "on_hold") {
			return "paused";
		}
		if (normalized === "failed") {
			return "unpaid";
		}
		return normalized;
	})();

	const badgeLabels: Record<string, string> = {
		active: t("settings.billing.activePlan.status.active"),
		canceled: t("settings.billing.activePlan.status.canceled"),
		expired: t("settings.billing.activePlan.status.expired"),
		incomplete: t("settings.billing.activePlan.status.incomplete"),
		past_due: t("settings.billing.activePlan.status.past_due"),
		paused: t("settings.billing.activePlan.status.paused"),
		trialing: t("settings.billing.activePlan.status.trialing"),
		unpaid: t("settings.billing.activePlan.status.unpaid"),
	};

	const label = badgeLabels[normalizedStatus] ?? normalizedStatus;

	return <Badge>{label}</Badge>;
}
