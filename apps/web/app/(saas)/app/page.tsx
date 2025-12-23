import { config } from "@repo/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import {
	getActiveOrganization,
	getOrganizationList,
	getSession,
} from "@saas/auth/lib/server";
import { HubPage } from "@saas/hub";
import type { OrganizationWithStats } from "@saas/hub";
import { orpcClient } from "@shared/lib/orpc-client";
import { attemptAsync } from "es-toolkit";
import { redirect } from "next/navigation";

export default async function AppHomePage() {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	const organizations = config.organizations.enable
		? await getOrganizationList()
		: [];

	// Fetch detailed org data with members and plans
	const organizationsWithStats: OrganizationWithStats[] = await Promise.all(
		organizations.map(async (org) => {
			// Get full organization with members
			const fullOrg = org.slug
				? await getActiveOrganization(org.slug)
				: null;

			const members = fullOrg?.members ?? [];
			const currentMember = members.find(
				(m) => m.userId === session.user.id,
			);

			// Get plan info if billing is enabled
			let planName: string | null = null;
			if (config.organizations.enableBilling) {
				const [, purchasesData] = await attemptAsync(() =>
					orpcClient.payments.listPurchases({
						organizationId: org.id,
					}),
				);
				if (purchasesData?.purchases) {
					const { activePlan } = createPurchasesHelper(
						purchasesData.purchases,
					);
					planName = activePlan?.id ?? null;
				}
			}

			return {
				id: org.id,
				name: org.name,
				slug: org.slug,
				logo: org.logo,
				createdAt: org.createdAt,
				memberCount: members.length,
				role: (currentMember?.role as "owner" | "admin" | "member") ?? "member",
				planName,
			};
		}),
	);

	return (
		<HubPage
			userName={session.user.name ?? "there"}
			organizations={organizationsWithStats}
		/>
	);
}
