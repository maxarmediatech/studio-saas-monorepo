import { isOrganizationAdmin } from "@repo/auth/lib/helper";
import { config } from "@repo/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { InviteMemberForm } from "@saas/organizations/components/InviteMemberForm";
import { OrganizationMembersBlock } from "@saas/organizations/components/OrganizationMembersBlock";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { SignOutButton } from "@saas/shared/components/SignOutButton";
import { orpcClient } from "@shared/lib/orpc-client";
import { attemptAsync } from "es-toolkit";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;

	const activeOrganization = await getActiveOrganization(organizationSlug);

	return {
		title: activeOrganization?.name,
	};
}

export default async function OrganizationPage({ params }: Props) {
	const { organizationSlug } = await params;

	const session = await getSession();

	const activeOrganization = await getActiveOrganization(organizationSlug);

	if (!activeOrganization) {
		return notFound();
	}

	const canManageMembers =
		Array.isArray(activeOrganization.members) &&
		isOrganizationAdmin(activeOrganization, session?.user);

	const billingEnabled =
		(config.organizations.enable && config.organizations.enableBilling) ||
		config.users.enableBilling;

	let activePlan:
		| ReturnType<typeof createPurchasesHelper>["activePlan"]
		| null = null;

	if (billingEnabled) {
		const [purchaseError, purchasesData] = await attemptAsync(() =>
			orpcClient.payments.listPurchases({
				organizationId: activeOrganization.id,
			}),
		);

		const purchases = purchaseError ? [] : (purchasesData?.purchases ?? []);
		activePlan = createPurchasesHelper(purchases).activePlan;
	}

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">
					Account overview
				</h1>
				<p className="text-muted-foreground">
					A quick snapshot of your profile, organization, and current
					plan.
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<section className="rounded-lg border bg-card p-4">
					<div className="text-sm font-medium text-muted-foreground">
						Account details
					</div>
					<dl className="mt-3 space-y-2 text-sm">
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">Name</dt>
							<dd className="font-medium">
								{session?.user.name ?? "Unknown"}
							</dd>
						</div>
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">Email</dt>
							<dd className="font-medium break-all">
								{session?.user.email ?? "—"}
							</dd>
						</div>
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">User ID</dt>
							<dd className="font-medium">
								{session?.user.id ?? "—"}
							</dd>
						</div>
					</dl>
				</section>

				<section className="rounded-lg border bg-card p-4">
					<div className="text-sm font-medium text-muted-foreground">
						Organization
					</div>
					<dl className="mt-3 space-y-2 text-sm">
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">Name</dt>
							<dd className="font-medium">
								{activeOrganization.name}
							</dd>
						</div>
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">Slug</dt>
							<dd className="font-medium">
								{activeOrganization.slug}
							</dd>
						</div>
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">ID</dt>
							<dd className="font-medium">
								{activeOrganization.id}
							</dd>
						</div>
					</dl>
				</section>
			</div>

			<section className="rounded-lg border bg-card p-4">
				<div className="text-sm font-medium text-muted-foreground">
					Purchased plan
				</div>
				{billingEnabled ? (
					<dl className="mt-3 space-y-2 text-sm">
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">Plan</dt>
							<dd className="font-medium">
								{activePlan?.id ?? "No active plan"}
							</dd>
						</div>
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">Status</dt>
							<dd className="font-medium">
								{activePlan?.status ?? "—"}
							</dd>
						</div>
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">
								Billing cycle
							</dt>
							<dd className="font-medium">
								{activePlan?.price
									? "interval" in activePlan.price
										? `${activePlan.price.interval}ly`
										: "one-time"
									: "—"}
							</dd>
						</div>
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">Price</dt>
							<dd className="font-medium">
								{activePlan?.price
									? `${activePlan.price.amount} ${activePlan.price.currency}`
									: "—"}
							</dd>
						</div>
					</dl>
				) : (
					<p className="mt-3 text-sm text-muted-foreground">
						Billing is currently disabled.
					</p>
				)}
			</section>

			<section className="rounded-lg border bg-card p-4 flex items-start justify-between gap-4">
				<div>
					<div className="text-sm font-medium text-muted-foreground">
						Session
					</div>
					<p className="text-sm text-muted-foreground mt-1">
						Sign out of your account.
					</p>
				</div>
				<SignOutButton />
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="text-xl font-semibold tracking-tight">
						Members
					</h2>
					<p className="text-muted-foreground">
						Invite teammates and review current access.
					</p>
				</div>
				<SettingsList>
					{canManageMembers && (
						<InviteMemberForm
							organizationId={activeOrganization.id}
						/>
					)}
					<OrganizationMembersBlock
						organizationId={activeOrganization.id}
					/>
				</SettingsList>
			</section>
		</div>
	);
}
