import { cn } from "@repo/ui/lib/utils";
import { getSession } from "@saas/auth/lib/server";
import { WhatsAppConfigSettingsPanel } from "@saas/settings/components/whatsapp-accounts-card";
import { WhatsAppTagsCard } from "@saas/settings/components/whatsapp-tags-card";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { WhatsAppTemplatesPageClient } from "@saas/studio";
import { buildStudioRoutePath } from "@saas/studio/lib/route-access";
import { requireStudioRouteAccess } from "@saas/studio/lib/server-access";
import Link from "next/link";
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
	const basePath = `/app/${organizationSlug}/messages/settings`;

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			<header className="shrink-0 border-b">
				<div className="flex h-16 items-center px-4 lg:px-6">
					<h1 className="text-lg font-semibold text-neutral-900">
						Settings
					</h1>
				</div>
				<div className="flex gap-6 overflow-x-auto px-4 lg:px-6">
					{tabs.map((tab) => {
						const isActive = tab.value === activeTab;
						const href =
							tab.value === "whatsapp"
								? basePath
								: `${basePath}?tab=${tab.value}`;

						return (
							<Link
								key={tab.value}
								href={href}
								className={cn(
									"relative shrink-0 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
									isActive && "text-foreground",
								)}
							>
								{tab.label}
								{isActive ? (
									<span className="absolute inset-x-0 bottom-0 h-0.5 bg-neutral-900" />
								) : null}
							</Link>
						);
					})}
				</div>
			</header>

			<main className="min-h-0 flex-1 overflow-y-auto">
				{activeTab === "whatsapp" ? (
					<WhatsAppConfigSettingsPanel />
				) : null}
				{activeTab === "templates" ? (
					<WhatsAppTemplatesPageClient />
				) : null}
				{activeTab === "tags" ? (
					<SettingsList>
						<WhatsAppTagsCard />
					</SettingsList>
				) : null}
			</main>
		</div>
	);
}
