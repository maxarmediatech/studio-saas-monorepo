import { config } from "@repo/config";
import { resolveAppRedirectPath } from "@saas/auth/lib/redirects";
import { getSession } from "@saas/auth/lib/server";
import { SettingsMenu } from "@saas/settings/components/SettingsMenu";
import { ConfirmationAlertProvider } from "@saas/shared/components/ConfirmationAlertProvider";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { SidebarContentLayout } from "@saas/shared/components/SidebarContentLayout";
import { Logo } from "@shared/components/Logo";
import { Building2Icon, UsersIcon } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { PropsWithChildren } from "react";

export const instant = false;

export default async function AdminLayout({ children }: PropsWithChildren) {
	const t = await getTranslations();
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	const isPlatformAdmin = config.auth.platformAdminUserIds.some(
		(adminUserId) => adminUserId === session.user.id,
	);

	if (!isPlatformAdmin) {
		const activeOrganizationSlug = (await cookies()).get(
			"activeOrganizationSlug",
		)?.value;
		const appRedirectPath = activeOrganizationSlug
			? resolveAppRedirectPath("/app", activeOrganizationSlug)
			: "/app";
		redirect(appRedirectPath);
	}

	return (
		<>
			<PageHeader
				title={t("admin.title")}
				subtitle={t("admin.description")}
			/>
			<ConfirmationAlertProvider>
				<SidebarContentLayout
					sidebar={
						<SettingsMenu
							menuItems={[
								{
									avatar: (
										<Logo
											className="h-8 w-[2.9rem]"
											variant="badge"
										/>
									),
									title: t("admin.title"),
									items: [
										{
											title: t("admin.menu.users"),
											href: "/admin/users",
											icon: (
												<UsersIcon className="size-4 opacity-50" />
											),
										},
										...(config.organizations.enable
											? [
													{
														title: t(
															"admin.menu.organizations",
														),
														href: "/admin/organizations",
														icon: (
															<Building2Icon className="size-4 opacity-50" />
														),
													},
												]
											: []),
									],
								},
							]}
						/>
					}
				>
					{children}
				</SidebarContentLayout>
			</ConfirmationAlertProvider>
		</>
	);
}
