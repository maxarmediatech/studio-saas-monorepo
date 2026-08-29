import { NotificationPreferencesForm } from "@saas/settings/components/NotificationPreferencesForm";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SettingsPageFallback } from "../_components/settings-page-fallback";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export const metadata: Metadata = { title: "Notification Settings" };

export default function NotificationsSettingsPage({ params }: Props) {
	return (
		<Suspense fallback={<SettingsPageFallback />}>
			<NotificationsSettingsContent params={params} />
		</Suspense>
	);
}

async function NotificationsSettingsContent({ params }: Props) {
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"notifications",
	);

	if (!context) {
		return notFound();
	}

	return (
		<div className="px-4 pt-6 pb-8 lg:px-6">
			<NotificationPreferencesForm />
		</div>
	);
}
