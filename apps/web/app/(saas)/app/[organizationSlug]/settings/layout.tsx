import { Skeleton } from "@repo/ui/components/skeleton";
import { getVisibleSettingsNavigation } from "@saas/settings/lib/server-access";
import { PageWidthWrapper } from "@saas/studio/components/PageWidthWrapper";
import { type PropsWithChildren, Suspense } from "react";
import { SettingsNav } from "./settings-nav";

type SettingsLayoutProps = PropsWithChildren<{
	params: Promise<{ organizationSlug: string }>;
}>;

function SettingsNavigationFallback() {
	return (
		<div
			className="shrink-0 border-neutral-200 border-b"
			aria-hidden="true"
		>
			<PageWidthWrapper>
				<div className="flex h-12 items-center sm:h-16">
					<Skeleton className="h-5 w-24" />
				</div>
			</PageWidthWrapper>
		</div>
	);
}

async function SettingsNavigation({
	params,
}: Pick<SettingsLayoutProps, "params">) {
	const { organizationSlug } = await params;
	const navigation = await getVisibleSettingsNavigation(organizationSlug);

	return (
		<SettingsNav
			groups={navigation.groups}
			standalonePages={navigation.standalonePages}
		/>
	);
}

export default function SettingsLayout({
	children,
	params,
}: SettingsLayoutProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<Suspense fallback={<SettingsNavigationFallback />}>
				<SettingsNavigation params={params} />
			</Suspense>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto w-full max-w-screen-xl">{children}</div>
			</div>
		</div>
	);
}
