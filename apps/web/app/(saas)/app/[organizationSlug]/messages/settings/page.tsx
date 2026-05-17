import { getSession } from "@saas/auth/lib/server";
import { WhatsAppConfigSettingsPanel } from "@saas/settings/components/whatsapp-accounts-card";
import { WhatsAppTagsCard } from "@saas/settings/components/whatsapp-tags-card";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { WhatsAppTemplatesPageClient } from "@saas/studio";
import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import { notFound, redirect } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<{ tab?: string }>;
};

const tabs = [
	{ value: "whatsapp", label: "WhatsApp Config" },
	{ value: "templates", label: "Templates" },
	{ value: "tags", label: "Tags" },
] as const;

type TabValue = (typeof tabs)[number]["value"];

function isTabValue(value: string | undefined): value is TabValue {
	return tabs.some((tab) => tab.value === value);
}

export async function generateMetadata() {
	return {
		title: "Message Settings",
	};
}

export default async function MessageSettingsPage({
	params,
	searchParams,
}: Props) {
	const { organizationSlug } = await params;
	const { tab: requestedTab } = await searchParams;

	if (
		!(await requireStudioRouteAccess(
			organizationSlug,
			buildStudioRoutePath(organizationSlug, "/messages/settings"),
		))
	) {
		notFound();
	}

	const session = await getSession();
	if (!session) {
		redirect("/auth/login");
	}

	const activeTab = isTabValue(requestedTab) ? requestedTab : "whatsapp";
	return (
		<>
			{activeTab === "whatsapp" ? <WhatsAppConfigSettingsPanel /> : null}
			{activeTab === "templates" ? <WhatsAppTemplatesPageClient /> : null}
			{activeTab === "tags" ? (
				<SettingsList>
					<WhatsAppTagsCard />
				</SettingsList>
			) : null}
		</>
	);
}
