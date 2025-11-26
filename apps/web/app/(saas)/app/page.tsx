import { config } from "@repo/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
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

	const activeOrganization = config.organizations.enable
		? organizations.find(
				(org) => org.id === session?.session.activeOrganizationId,
			) || organizations.at(0)
		: undefined;

	const organizationId =
		config.organizations.enable && activeOrganization
			? activeOrganization.id
			: undefined;

	const billingEnabled =
		(config.organizations.enable && config.organizations.enableBilling) ||
		config.users.enableBilling;

	let activePlan:
		| ReturnType<typeof createPurchasesHelper>["activePlan"]
		| null = null;

	if (billingEnabled) {
		const [purchaseError, purchasesData] = await attemptAsync(() =>
			orpcClient.payments.listPurchases({
				organizationId,
			}),
		);

		const purchases = purchaseError ? [] : purchasesData?.purchases ?? [];
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
								{session.user.name ?? "Unknown"}
							</dd>
						</div>
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">Email</dt>
							<dd className="font-medium break-all">
								{session.user.email}
							</dd>
						</div>
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">User ID</dt>
							<dd className="font-medium">
								{session.user.id}
							</dd>
						</div>
					</dl>
				</section>

				<section className="rounded-lg border bg-card p-4">
					<div className="text-sm font-medium text-muted-foreground">
						Organization
					</div>
					{config.organizations.enable ? (
						<dl className="mt-3 space-y-2 text-sm">
							<div className="flex justify-between gap-4">
								<dt className="text-muted-foreground">
									Name
								</dt>
								<dd className="font-medium">
									{activeOrganization?.name ??
										"No organization"}
								</dd>
							</div>
							<div className="flex justify-between gap-4">
								<dt className="text-muted-foreground">
									Slug
								</dt>
								<dd className="font-medium">
									{activeOrganization?.slug ?? "—"}
								</dd>
							</div>
							<div className="flex justify-between gap-4">
								<dt className="text-muted-foreground">ID</dt>
								<dd className="font-medium">
									{activeOrganization?.id ?? "—"}
								</dd>
							</div>
						</dl>
					) : (
						<p className="mt-3 text-sm text-muted-foreground">
							Organizations are disabled for this workspace.
						</p>
					)}
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
									? `${activePlan.price.interval}ly`
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
		</div>
	);
}
