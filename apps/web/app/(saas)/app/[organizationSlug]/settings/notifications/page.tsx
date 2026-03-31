import { NotificationPreferencesForm } from "@saas/settings/components/NotificationPreferencesForm";
import { requireSettingsRouteAccess } from "@saas/settings/lib/server-access";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const context = await requireSettingsRouteAccess(
		organizationSlug,
		"notifications",
	);

	return {
		title: `Notification Settings | ${context?.organization.name ?? "Studio"}`,
	};
}

export default async function NotificationsSettingsPage({ params }: Props) {
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
